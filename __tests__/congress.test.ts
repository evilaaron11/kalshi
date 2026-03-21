import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --------------------------------------------------------------------------
// Mock ../lib/httpClient before importing the module under test.
// vi.mock is hoisted to the top of the file, so the factory must not
// reference variables declared outside it. Use vi.hoisted() instead.
// --------------------------------------------------------------------------
const { mockGetJson, mockGetText } = vi.hoisted(() => {
  return { mockGetJson: vi.fn(), mockGetText: vi.fn() };
});

vi.mock("../lib/httpClient", () => ({
  getJson: mockGetJson,
  get: vi.fn(),
  getText: mockGetText,
}));

import {
  searchBills,
  getBillDetails,
  getFloorSchedule,
  getPrognosis,
} from "../lib/fetchers/congress";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Minimal raw bill shape as returned by the Congress.gov API */
function makeBillRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "HR",
    number: "1234",
    title: "A Bill For Testing",
    congress: 119,
    introducedDate: "2025-01-15",
    latestAction: { text: "Referred to committee", actionDate: "2025-01-20" },
    sponsors: [{ firstName: "Jane", lastName: "Doe", party: "D" }],
    cosponsors: 3,
    committees: {},
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Setup / teardown
// --------------------------------------------------------------------------

const ORIGINAL_API_KEY = process.env.CONGRESS_API_KEY;

beforeEach(() => {
  mockGetJson.mockReset();
  mockGetText.mockReset();
  process.env.CONGRESS_API_KEY = "test-api-key-123";
});

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.CONGRESS_API_KEY;
  } else {
    process.env.CONGRESS_API_KEY = ORIGINAL_API_KEY;
  }
});

// --------------------------------------------------------------------------
// searchBills
// --------------------------------------------------------------------------

describe("searchBills", () => {
  it("returns an array of CongressBill on success", async () => {
    mockGetJson.mockResolvedValueOnce({
      bills: [makeBillRaw(), makeBillRaw({ number: "5678", type: "S" })],
    });

    const results = await searchBills({ query: "budget reconciliation" });

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);

    const first = results[0];
    expect(first.source).toBe("congress.gov");
    expect(first.number).toBe("1234");
    expect(first.type).toBe("hr");
    expect(first.billId).toBe("hr1234");
    expect(first.title).toBe("A Bill For Testing");
    expect(first.sponsor).toBe("Jane Doe");
    expect(first.sponsorParty).toBe("D");
    expect(first.cosponsorCount).toBe(3);
  });

  it("returns an empty array when the API returns no bills", async () => {
    mockGetJson.mockResolvedValueOnce({ bills: [] });

    const results = await searchBills({ query: "unicorn bill" });

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it("returns an empty array when getJson returns null (network error)", async () => {
    mockGetJson.mockResolvedValueOnce(null);

    const results = await searchBills({ query: "budget" });

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it("passes congress filter as a query param when provided", async () => {
    mockGetJson.mockResolvedValueOnce({ bills: [] });

    await searchBills({ query: "tax", congress: 118, limit: 5 });

    const callArgs = mockGetJson.mock.calls[0];
    const params = callArgs[1]?.params as Record<string, string>;
    expect(params.congress).toBe("118");
    expect(params.limit).toBe("5");
    expect(params.query).toBe("tax");
  });

  it("logs warning and returns empty array when API key is missing", async () => {
    delete process.env.CONGRESS_API_KEY;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await searchBills({ query: "spending" });

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("CONGRESS_API_KEY"),
    );
    expect(mockGetJson).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// --------------------------------------------------------------------------
// getBillDetails
// --------------------------------------------------------------------------

describe("getBillDetails", () => {
  it("returns null for an unparseable bill ID", async () => {
    const result = await getBillDetails("xyz-not-a-bill");
    expect(result).toBeNull();
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("returns null when the API returns no bill data", async () => {
    // bill endpoint returns null, actions and cosponsors can return anything
    mockGetJson
      .mockResolvedValueOnce(null) // bill
      .mockResolvedValueOnce(null) // actions
      .mockResolvedValueOnce(null); // cosponsors

    const result = await getBillDetails("hr9999");
    expect(result).toBeNull();
  });

  it("returns CongressBillDetail for a valid HR bill", async () => {
    mockGetJson
      .mockResolvedValueOnce({ bill: makeBillRaw() }) // bill
      .mockResolvedValueOnce({
        actions: {
          items: [
            { actionDate: "2025-02-01", text: "Passed House" },
            { actionDate: "2025-03-10", text: "Referred to Senate committee" },
          ],
        },
      }) // actions
      .mockResolvedValueOnce({
        cosponsors: {
          items: [
            { firstName: "John", lastName: "Smith", party: "R", state: "TX" },
          ],
        },
      }); // cosponsors

    const detail = await getBillDetails("hr1234");

    expect(detail).not.toBeNull();
    expect(detail!.billId).toBe("hr1234");
    expect(detail!.source).toBe("congress.gov");
    expect(detail!.actions).toHaveLength(2);
    expect(detail!.actions[0].text).toBe("Passed House");
    expect(detail!.cosponsors).toHaveLength(1);
    expect(detail!.cosponsors[0].name).toBe("John Smith");
    expect(detail!.cosponsors[0].party).toBe("R");
    expect(detail!.cosponsors[0].state).toBe("TX");
  });

  it("handles senate bill IDs (s5678)", async () => {
    mockGetJson
      .mockResolvedValueOnce({ bill: makeBillRaw({ type: "S", number: "5678" }) })
      .mockResolvedValueOnce({ actions: { items: [] } })
      .mockResolvedValueOnce({ cosponsors: { items: [] } });

    const detail = await getBillDetails("s5678");

    expect(detail).not.toBeNull();
    expect(detail!.type).toBe("s");

    // Verify the URL called had the right path segments
    const callUrl = mockGetJson.mock.calls[0][0] as string;
    expect(callUrl).toContain("/bill/119/s/5678");
  });

  it("handles joint resolution IDs (hjres)", async () => {
    mockGetJson
      .mockResolvedValueOnce({ bill: makeBillRaw({ type: "HJRES", number: "77" }) })
      .mockResolvedValueOnce({ actions: { items: [] } })
      .mockResolvedValueOnce({ cosponsors: { items: [] } });

    const detail = await getBillDetails("hjres77");

    expect(detail).not.toBeNull();
    const callUrl = mockGetJson.mock.calls[0][0] as string;
    expect(callUrl).toContain("/bill/119/hjres/77");
  });

  it("handles gracefully when actions / cosponsors sub-requests fail", async () => {
    mockGetJson
      .mockResolvedValueOnce({ bill: makeBillRaw() })
      .mockResolvedValueOnce(null) // actions endpoint fails
      .mockResolvedValueOnce(null); // cosponsors endpoint fails

    const detail = await getBillDetails("hr1234");

    expect(detail).not.toBeNull();
    expect(detail!.actions).toEqual([]);
    expect(detail!.cosponsors).toEqual([]);
  });

  it("logs warning and returns null when API key is missing", async () => {
    delete process.env.CONGRESS_API_KEY;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getBillDetails("hr1234");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("CONGRESS_API_KEY"),
    );
    expect(mockGetJson).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// --------------------------------------------------------------------------
// getFloorSchedule
// --------------------------------------------------------------------------

describe("getFloorSchedule", () => {
  it("returns an array (possibly empty) for the house", async () => {
    mockGetJson.mockResolvedValueOnce({
      floorActions: {
        items: [
          {
            actionDate: "2025-04-01",
            billNumber: "HR 100",
            actionDescription: "Consideration of HR 100",
          },
        ],
      },
    });

    const results = await getFloorSchedule("house");

    expect(Array.isArray(results)).toBe(true);
    expect(results[0].chamber).toBe("House");
    expect(results[0].source).toBe("congress.gov");
    expect(results[0].billNumber).toBe("HR 100");
  });

  it("returns an array for the senate", async () => {
    mockGetJson.mockResolvedValueOnce({
      floorActions: {
        items: [
          {
            actionTime: "2025-04-02T10:00:00",
            actionDescription: "Cloture vote on S 200",
          },
        ],
      },
    });

    const results = await getFloorSchedule("senate");

    expect(Array.isArray(results)).toBe(true);
    expect(results[0].chamber).toBe("Senate");
    expect(results[0].date).toBe("2025-04-02T10:00:00");
  });

  it("fetches both chambers when no argument is given", async () => {
    mockGetJson
      .mockResolvedValueOnce({ floorActions: { items: [] } })
      .mockResolvedValueOnce({ floorActions: { items: [] } });

    const results = await getFloorSchedule();

    expect(Array.isArray(results)).toBe(true);
    // Two calls should have been made (one per chamber)
    expect(mockGetJson).toHaveBeenCalledTimes(2);
    const urls = mockGetJson.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("house-floor-action"))).toBe(true);
    expect(urls.some((u) => u.includes("senate-floor-action"))).toBe(true);
  });

  it("returns empty array when the API returns null", async () => {
    mockGetJson.mockResolvedValueOnce(null);

    const results = await getFloorSchedule("house");

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it("logs warning and returns empty array when API key is missing", async () => {
    delete process.env.CONGRESS_API_KEY;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await getFloorSchedule("senate");

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("CONGRESS_API_KEY"),
    );
    expect(mockGetJson).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("sorts results chronologically when fetching both chambers", async () => {
    mockGetJson
      .mockResolvedValueOnce({
        floorActions: {
          items: [{ actionDate: "2025-04-05", actionDescription: "House item" }],
        },
      })
      .mockResolvedValueOnce({
        floorActions: {
          items: [{ actionDate: "2025-04-03", actionDescription: "Senate item" }],
        },
      });

    const results = await getFloorSchedule();

    expect(results[0].date).toBe("2025-04-03"); // Senate item should come first
    expect(results[1].date).toBe("2025-04-05");
  });
});

// --------------------------------------------------------------------------
// getPrognosis
// --------------------------------------------------------------------------

/** Build a minimal GovTrack HTML page with a prognosis percentage */
function makePrognosisHtml(opts: {
  percentage?: number;       // integer 0–100; omit to produce a page with no prognosis
  useDataValue?: boolean;    // if true, embed as data-value (fractional)
  factors?: string[];        // <li> items to include
  lastUpdated?: string;      // ISO date string
} = {}): string {
  const { percentage, useDataValue = false, factors = [], lastUpdated } = opts;

  let prognosisBlock = "";
  if (percentage !== undefined) {
    if (useDataValue) {
      const frac = (percentage / 100).toFixed(2);
      prognosisBlock = `<div class="prognosis-widget" data-value="${frac}">Prognosis</div>`;
    } else {
      prognosisBlock = `<section id="prognosis"><h3>Prognosis</h3><p>${percentage}% chance of being enacted.</p></section>`;
    }
  }

  const factorItems = factors.map((f) => `<li>${f}</li>`).join("\n");
  const factorList = factors.length ? `<ul>${factorItems}</ul>` : "";

  const updatedLine = lastUpdated
    ? `<p>Last updated ${lastUpdated}</p>`
    : "";

  return `<!DOCTYPE html><html><body>
<h1>H.R. 1234</h1>
${prognosisBlock}
${factorList}
${updatedLine}
</body></html>`;
}

describe("getPrognosis", () => {
  it("returns null when getText returns null (page not found)", async () => {
    mockGetText.mockResolvedValueOnce(null);

    const result = await getPrognosis("hr1234");

    expect(result).toBeNull();
    expect(mockGetText).toHaveBeenCalledTimes(1);
    const calledUrl = mockGetText.mock.calls[0][0] as string;
    expect(calledUrl).toContain("govtrack.us");
    expect(calledUrl).toContain("hr1234");
  });

  it("returns null when the page exists but contains no prognosis percentage", async () => {
    mockGetText.mockResolvedValueOnce(makePrognosisHtml({})); // no percentage

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getPrognosis("hr1234");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no prognosis percentage"));
    warnSpy.mockRestore();
  });

  it("parses a '% chance' prognosis from an HR bill", async () => {
    mockGetText.mockResolvedValueOnce(
      makePrognosisHtml({ percentage: 7, factors: ["Has a bipartisan sponsor", "Was referred to committee"] }),
    );

    const result = await getPrognosis("hr1234");

    expect(result).not.toBeNull();
    expect(result!.billId).toBe("hr1234");
    expect(result!.passage).toBe(7);
    expect(result!.source).toBe("govtrack");
    expect(Array.isArray(result!.factors)).toBe(true);
    expect(result!.factors.length).toBeGreaterThanOrEqual(1);
    expect(result!.lastUpdated).toBeTruthy();
  });

  it("parses a data-value fractional prognosis (senate bill)", async () => {
    mockGetText.mockResolvedValueOnce(
      makePrognosisHtml({ percentage: 3, useDataValue: true }),
    );

    const result = await getPrognosis("s5678");

    expect(result).not.toBeNull();
    expect(result!.passage).toBe(3);
    expect(result!.billId).toBe("s5678");
    expect(result!.source).toBe("govtrack");
  });

  it("extracts the lastUpdated date when present on the page", async () => {
    mockGetText.mockResolvedValueOnce(
      makePrognosisHtml({ percentage: 12, lastUpdated: "2025-03-01" }),
    );

    const result = await getPrognosis("hr1234");

    expect(result).not.toBeNull();
    expect(result!.lastUpdated).toBe("2025-03-01");
  });

  it("returns null for an unparseable bill ID without calling getText", async () => {
    const result = await getPrognosis("xyz-not-a-bill");

    expect(result).toBeNull();
    expect(mockGetText).not.toHaveBeenCalled();
  });

  it("constructs the correct GovTrack URL for hjres bills", async () => {
    mockGetText.mockResolvedValueOnce(
      makePrognosisHtml({ percentage: 5 }),
    );

    await getPrognosis("hjres77");

    const calledUrl = mockGetText.mock.calls[0][0] as string;
    expect(calledUrl).toContain("govtrack.us");
    expect(calledUrl).toContain("hjres77");
  });

  it("handles a high-confidence bill (90%+) correctly", async () => {
    mockGetText.mockResolvedValueOnce(
      makePrognosisHtml({ percentage: 92 }),
    );

    const result = await getPrognosis("s100");

    expect(result).not.toBeNull();
    expect(result!.passage).toBe(92);
  });
});
