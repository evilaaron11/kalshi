import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock ../lib/httpClient BEFORE importing the module under test.
// ---------------------------------------------------------------------------
const { mockGetJson, mockGetText } = vi.hoisted(() => ({
  mockGetJson: vi.fn(),
  mockGetText: vi.fn(),
}));

vi.mock("../lib/httpClient", () => ({
  getJson: mockGetJson,
  getText: mockGetText,
  get: vi.fn(),
}));

import {
  getMembers,
  getNominationVotes,
  getWhipEstimate,
} from "../lib/fetchers/senate";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeCongressMember(
  overrides: Partial<{
    bioguideId: string;
    name: string;
    partyName: string;
    state: string;
    terms: { item: Array<{ startYear: number; endYear: number }> };
  }> = {},
) {
  return {
    bioguideId: "A000001",
    name: "Doe, Jane",
    partyName: "Democratic",
    state: "NY",
    terms: { item: [{ startYear: 2021, endYear: 2027 }] },
    ...overrides,
  };
}

function makeMembersResponse(members: ReturnType<typeof makeCongressMember>[]) {
  return { members };
}

function makeVoteXml(votes: Array<{
  vote_number: string;
  title: string;
  vote_date: string;
  yeas: string;
  nays: string;
  result: string;
}>): string {
  const voteBlocks = votes.map((v) => `
    <vote>
      <vote_number>${v.vote_number}</vote_number>
      <title>${v.title}</title>
      <vote_date>${v.vote_date}</vote_date>
      <yeas>${v.yeas}</yeas>
      <nays>${v.nays}</nays>
      <result>${v.result}</result>
    </vote>
  `).join("\n");
  return `<vote_summary>${voteBlocks}</vote_summary>`;
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const ORIGINAL_KEY = process.env.CONGRESS_API_KEY;

beforeEach(() => {
  mockGetJson.mockReset();
  mockGetText.mockReset();
  process.env.CONGRESS_API_KEY = "test-congress-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.CONGRESS_API_KEY;
  } else {
    process.env.CONGRESS_API_KEY = ORIGINAL_KEY;
  }
});

// ---------------------------------------------------------------------------
// getMembers
// ---------------------------------------------------------------------------

describe("getMembers", () => {
  it("returns a Senator array mapped from Congress.gov members", async () => {
    mockGetJson.mockResolvedValueOnce(
      makeMembersResponse([
        makeCongressMember({
          bioguideId: "A000001",
          name: "Doe, Jane",
          partyName: "Democratic",
          state: "NY",
        }),
        makeCongressMember({
          bioguideId: "B000002",
          name: "Smith, John",
          partyName: "Republican",
          state: "TX",
        }),
      ]),
    );

    const result = await getMembers();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Doe, Jane");
    expect(result[0].party).toBe("D");
    expect(result[0].state).toBe("NY");
    expect(result[0].memberId).toBe("A000001");
    expect(result[0].source).toBe("congress.gov");
  });

  it("filters senators by party", async () => {
    mockGetJson.mockResolvedValueOnce(
      makeMembersResponse([
        makeCongressMember({ bioguideId: "R001", partyName: "Republican", state: "TX" }),
        makeCongressMember({ bioguideId: "D001", partyName: "Democratic", state: "NY" }),
        makeCongressMember({ bioguideId: "R002", partyName: "Republican", state: "AK" }),
      ]),
    );

    const republicans = await getMembers("R");

    expect(republicans).toHaveLength(2);
    expect(republicans.every((s) => s.party === "R")).toBe(true);
  });

  it("maps party names correctly (D, R, I)", async () => {
    mockGetJson.mockResolvedValueOnce(
      makeMembersResponse([
        makeCongressMember({ partyName: "Democratic" }),
        makeCongressMember({ partyName: "Republican" }),
        makeCongressMember({ partyName: "Independent" }),
      ]),
    );

    const result = await getMembers();
    expect(result.map((s) => s.party)).toEqual(["D", "R", "I"]);
  });

  it("warns and returns empty when CONGRESS_API_KEY is missing", async () => {
    delete process.env.CONGRESS_API_KEY;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getMembers();

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CONGRESS_API_KEY"));
    expect(mockGetJson).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("returns empty array when API returns null", async () => {
    mockGetJson.mockResolvedValueOnce(null);
    const result = await getMembers();
    expect(result).toHaveLength(0);
  });

  it("passes api_key and currentMember params", async () => {
    mockGetJson.mockResolvedValueOnce(makeMembersResponse([]));
    await getMembers();

    const [, opts] = mockGetJson.mock.calls[0];
    expect(opts.params.api_key).toBe("test-congress-key");
    expect(opts.params.currentMember).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// getNominationVotes
// ---------------------------------------------------------------------------

describe("getNominationVotes", () => {
  it("parses confirmation votes from senate.gov XML", async () => {
    mockGetText.mockResolvedValueOnce(
      makeVoteXml([
        {
          vote_number: "42",
          title: "Confirmation: John Smith to be Secretary of Defense",
          vote_date: "2025-02-10",
          yeas: "55",
          nays: "45",
          result: "Confirmed",
        },
        {
          vote_number: "43",
          title: "On the Motion to Table",
          vote_date: "2025-02-11",
          yeas: "51",
          nays: "49",
          result: "Agreed to",
        },
      ]),
    );

    const result = await getNominationVotes();

    // Only the confirmation vote should be returned
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain("Confirmation");
    expect(result[0].yesVotes).toBe(55);
    expect(result[0].noVotes).toBe(45);
    expect(result[0].result).toBe("Confirmed");
    expect(result[0].source).toBe("senate.gov");
  });

  it("defaults to congress 119 session 1", async () => {
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");
    await getNominationVotes();

    const url = mockGetText.mock.calls[0][0] as string;
    expect(url).toContain("vote_menu_119_1.xml");
  });

  it("uses supplied congress number", async () => {
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");
    await getNominationVotes(118);

    const url = mockGetText.mock.calls[0][0] as string;
    expect(url).toContain("vote_menu_118_1.xml");
  });

  it("returns empty when XML fetch fails", async () => {
    mockGetText.mockResolvedValueOnce(null);
    const result = await getNominationVotes();
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    const votes = Array.from({ length: 30 }, (_, i) => ({
      vote_number: String(i + 1),
      title: `Confirmation: Nominee ${i}`,
      vote_date: "2025-03-01",
      yeas: "55",
      nays: "45",
      result: "Confirmed",
    }));

    mockGetText.mockResolvedValueOnce(makeVoteXml(votes));

    const result = await getNominationVotes(119, 5);
    expect(result).toHaveLength(5);
  });

  it("includes advise and consent votes", async () => {
    mockGetText.mockResolvedValueOnce(
      makeVoteXml([
        {
          vote_number: "10",
          title: "On the Advise and Consent of the Senate",
          vote_date: "2025-01-20",
          yeas: "60",
          nays: "40",
          result: "Confirmed",
        },
      ]),
    );

    const result = await getNominationVotes();
    expect(result).toHaveLength(1);
  });

  it("does not require any API key (senate.gov is public)", async () => {
    delete process.env.CONGRESS_API_KEY;
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");

    const result = await getNominationVotes();
    expect(result).toEqual([]);
    // Should still have called getText (no API key gate)
    expect(mockGetText).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getWhipEstimate
// ---------------------------------------------------------------------------

describe("getWhipEstimate", () => {
  it("returns a WhipEstimate with correct shape and source", async () => {
    mockGetJson.mockResolvedValueOnce(
      makeMembersResponse([
        makeCongressMember({ partyName: "Republican", state: "TX" }),
        makeCongressMember({ partyName: "Democratic", state: "CA" }),
      ]),
    );
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");

    const estimate = await getWhipEstimate("cabinet secretary");

    expect(estimate).toMatchObject({
      nomineeType: "cabinet secretary",
      source: "congress.gov",
    });
    expect(typeof estimate.estimatedYes).toBe("number");
    expect(typeof estimate.estimatedNo).toBe("number");
    expect(typeof estimate.estimatedUncertain).toBe("number");
    expect(Array.isArray(estimate.swingSenators)).toBe(true);
  });

  it("estimatedYes reflects majority-party count", async () => {
    const senators = [
      ...Array.from({ length: 53 }, (_, i) =>
        makeCongressMember({ bioguideId: `R${i}`, partyName: "Republican", state: "TX" }),
      ),
      ...Array.from({ length: 47 }, (_, i) =>
        makeCongressMember({ bioguideId: `D${i}`, partyName: "Democratic", state: "CA" }),
      ),
    ];

    mockGetJson.mockResolvedValueOnce(makeMembersResponse(senators));
    // No nomination votes in XML
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");

    const estimate = await getWhipEstimate("federal judge");

    expect(estimate.estimatedYes).toBe(53);
    expect(estimate.estimatedNo).toBe(47);
  });

  it("identifies swing senators from competitive states", async () => {
    const senators = [
      makeCongressMember({ bioguideId: "R_ME", partyName: "Republican", state: "ME" }),
      makeCongressMember({ bioguideId: "R_TX", partyName: "Republican", state: "TX" }),
      makeCongressMember({ bioguideId: "D_AZ", partyName: "Democratic", state: "AZ" }),
      makeCongressMember({ bioguideId: "D_CA", partyName: "Democratic", state: "CA" }),
    ];

    mockGetJson.mockResolvedValueOnce(makeMembersResponse(senators));
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");

    const estimate = await getWhipEstimate("ambassador");

    const swingStates = estimate.swingSenators.map((s) => s.state);
    expect(swingStates).toContain("ME");
    expect(swingStates).toContain("AZ");
    expect(swingStates).not.toContain("TX");
    expect(swingStates).not.toContain("CA");
  });

  it("handles empty member list gracefully", async () => {
    mockGetJson.mockResolvedValueOnce(makeMembersResponse([]));
    mockGetText.mockResolvedValueOnce("<vote_summary></vote_summary>");

    const estimate = await getWhipEstimate("judge");

    expect(estimate.estimatedYes).toBe(0);
    expect(estimate.estimatedNo).toBe(0);
    expect(estimate.estimatedUncertain).toBe(0);
    expect(estimate.swingSenators).toEqual([]);
  });
});
