import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock httpClient before any module imports
vi.mock("../lib/httpClient", () => ({
  getJson: vi.fn(),
}));

import { getJson } from "../lib/httpClient";
import {
  searchManifold,
  searchPolymarket,
  searchMetaculus,
  searchCrossMarket,
} from "../lib/fetchers/crossMarket";

const mockGetJson = vi.mocked(getJson);

// --- Manifold fixtures ---

const MANIFOLD_OPEN_MARKET = {
  id: "abc123",
  question: "Will the US government shut down in 2026?",
  probability: 0.32,
  volume: 15000,
  url: "https://manifold.markets/user/shutdown-2026",
  isResolved: false,
  closeTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
  creatorUsername: "user",
  slug: "shutdown-2026",
};

const MANIFOLD_RESOLVED_MARKET = {
  id: "def456",
  question: "Will event X happen?",
  probability: 1.0,
  volume: 5000,
  url: "https://manifold.markets/user/event-x",
  isResolved: true,
  closeTime: Date.now() - 1000,
  creatorUsername: "user",
  slug: "event-x",
};

const MANIFOLD_CLOSED_MARKET = {
  id: "ghi789",
  question: "Did Y happen last year?",
  probability: 0.8,
  volume: 2000,
  url: "https://manifold.markets/user/y-last-year",
  isResolved: false,
  closeTime: Date.now() - 60 * 60 * 1000, // 1 hour ago
  creatorUsername: "user",
  slug: "y-last-year",
};

// --- Polymarket fixtures ---

const POLYMARKET_RESPONSE = {
  events: [
    {
      title: "US Government Shutdown",
      slug: "us-gov-shutdown",
      markets: [
        {
          question: "Will there be a government shutdown?",
          closed: false,
          archived: false,
          outcomePrices: '["0.45", "0.55"]',
          volume_num_24hr: 8000,
        },
      ],
    },
  ],
};

beforeEach(() => {
  mockGetJson.mockReset();
  delete process.env.METACULUS_TOKEN;
});

// ============================
// searchManifold
// ============================

describe("searchManifold", () => {
  it("returns CrossMarketResult array for valid response", async () => {
    mockGetJson.mockResolvedValueOnce([MANIFOLD_OPEN_MARKET]);

    const results = await searchManifold("government shutdown");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      platform: "manifold",
      title: "Will the US government shut down in 2026?",
      probability: 0.32,
      volume: 15000,
      url: "https://manifold.markets/user/shutdown-2026",
    });
  });

  it("filters out resolved markets (isResolved === true)", async () => {
    mockGetJson.mockResolvedValueOnce([
      MANIFOLD_OPEN_MARKET,
      MANIFOLD_RESOLVED_MARKET,
    ]);

    const results = await searchManifold("test query");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Will the US government shut down in 2026?");
  });

  it("filters out closed markets (closeTime < Date.now())", async () => {
    mockGetJson.mockResolvedValueOnce([
      MANIFOLD_OPEN_MARKET,
      MANIFOLD_CLOSED_MARKET,
    ]);

    const results = await searchManifold("test query");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Will the US government shut down in 2026?");
  });

  it("filters out both resolved and closed markets", async () => {
    mockGetJson.mockResolvedValueOnce([
      MANIFOLD_RESOLVED_MARKET,
      MANIFOLD_CLOSED_MARKET,
    ]);

    const results = await searchManifold("test query");

    expect(results).toHaveLength(0);
  });

  it("returns empty array on API failure (null response)", async () => {
    mockGetJson.mockResolvedValueOnce(null);

    const results = await searchManifold("test query");

    expect(results).toEqual([]);
  });

  it("falls back to constructed URL when market.url is absent", async () => {
    const marketWithoutUrl = {
      ...MANIFOLD_OPEN_MARKET,
      url: undefined,
      creatorUsername: "testuser",
      slug: "my-market-slug",
    };
    mockGetJson.mockResolvedValueOnce([marketWithoutUrl]);

    const results = await searchManifold("test");

    expect(results[0].url).toBe(
      "https://manifold.markets/testuser/my-market-slug",
    );
  });

  it("passes term and limit as query params", async () => {
    mockGetJson.mockResolvedValueOnce([]);

    await searchManifold("election results", 3);

    expect(mockGetJson).toHaveBeenCalledWith(
      expect.stringContaining("/search-markets"),
      expect.objectContaining({
        params: expect.objectContaining({ term: "election results", limit: "3" }),
      }),
    );
  });
});

// ============================
// searchCrossMarket
// ============================

describe("searchCrossMarket", () => {
  it("includes manifold by default (three-platform default)", async () => {
    // polymarket returns empty, metaculus skipped (no token), manifold returns one result
    mockGetJson
      .mockResolvedValueOnce({ events: [] }) // polymarket
      .mockResolvedValueOnce([MANIFOLD_OPEN_MARKET]); // manifold

    const results = await searchCrossMarket("shutdown");

    const platforms = results.map((r) => r.platform);
    expect(platforms).toContain("manifold");
  });

  it("respects platforms filter — can exclude manifold", async () => {
    mockGetJson.mockResolvedValueOnce({ events: [] }); // polymarket only

    const results = await searchCrossMarket("shutdown", ["polymarket"]);

    // getJson should only have been called once (for polymarket)
    expect(mockGetJson).toHaveBeenCalledTimes(1);
    results.forEach((r) => expect(r.platform).not.toBe("manifold"));
  });

  it("calls only manifold when platforms = ['manifold']", async () => {
    mockGetJson.mockResolvedValueOnce([MANIFOLD_OPEN_MARKET]);

    const results = await searchCrossMarket("test", ["manifold"]);

    expect(mockGetJson).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].platform).toBe("manifold");
  });
});

// ============================
// searchPolymarket
// ============================

describe("searchPolymarket", () => {
  it("maps response to CrossMarketResult array correctly", async () => {
    mockGetJson.mockResolvedValueOnce(POLYMARKET_RESPONSE);

    const results = await searchPolymarket("shutdown");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      platform: "polymarket",
      title: "Will there be a government shutdown?",
      probability: 0.45,
      volume: 8000,
      url: "https://polymarket.com/event/us-gov-shutdown",
    });
  });

  it("returns empty array when getJson returns null", async () => {
    mockGetJson.mockResolvedValueOnce(null);

    const results = await searchPolymarket("shutdown");

    expect(results).toEqual([]);
  });

  it("skips closed markets", async () => {
    const closedResponse = {
      events: [
        {
          title: "Some Event",
          slug: "some-event",
          markets: [
            {
              question: "Closed market?",
              closed: true,
              archived: false,
              outcomePrices: '["0.9", "0.1"]',
              volume_num_24hr: 100,
            },
          ],
        },
      ],
    };
    mockGetJson.mockResolvedValueOnce(closedResponse);

    const results = await searchPolymarket("test");

    expect(results).toHaveLength(0);
  });
});

// ============================
// searchMetaculus
// ============================

describe("searchMetaculus", () => {
  it("returns empty array when METACULUS_TOKEN is not set", async () => {
    const results = await searchMetaculus("election");

    expect(results).toEqual([]);
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("maps valid response to CrossMarketResult array", async () => {
    process.env.METACULUS_TOKEN = "test-token";
    mockGetJson.mockResolvedValueOnce({
      results: [
        {
          id: 12345,
          title: "Will there be a recession in 2026?",
          question: {
            forecasters_count: 300,
            aggregations: {
              recency_weighted: {
                latest: {
                  centers: [0.28],
                },
              },
            },
          },
        },
      ],
    });

    const results = await searchMetaculus("recession");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      platform: "metaculus",
      title: "Will there be a recession in 2026?",
      probability: 0.28,
      forecasters: 300,
      url: "https://www.metaculus.com/questions/12345/",
    });
  });
});
