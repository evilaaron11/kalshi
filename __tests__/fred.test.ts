import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock httpClient before any module imports
vi.mock("../lib/httpClient", () => ({
  getJson: vi.fn(),
}));

import { getJson } from "../lib/httpClient";
import { getSeries, searchSeries, getReleaseDates } from "../lib/fetchers/fred";

const mockGetJson = vi.mocked(getJson);

// Minimal FRED API response fixtures
const MOCK_SERIES_META = {
  seriess: [
    {
      id: "CPIAUCSL",
      title: "Consumer Price Index for All Urban Consumers: All Items",
      frequency_short: "M",
      units: "Index 1982-1984=100",
      last_updated: "2026-03-14 07:52:13-05",
    },
  ],
};

const MOCK_OBSERVATIONS = {
  observations: [
    { date: "2026-02-01", value: "314.3" },
    { date: "2026-01-01", value: "313.9" },
    { date: "2025-12-01", value: "." }, // missing data — should be filtered
    { date: "2025-11-01", value: "312.4" },
  ],
};

const MOCK_SEARCH_RESULTS = {
  seriess: [
    {
      id: "CPIAUCSL",
      title: "Consumer Price Index for All Urban Consumers: All Items",
      frequency_short: "M",
      units: "Index 1982-1984=100",
      last_updated: "2026-03-14 07:52:13-05",
    },
    {
      id: "CPILFESL",
      title: "Consumer Price Index for All Urban Consumers: All Items Less Food & Energy",
      frequency_short: "M",
      units: "Index 1982-1984=100",
      last_updated: "2026-03-14 07:52:13-05",
    },
  ],
};

const MOCK_RELEASE_INFO = {
  releases: [{ id: 10, name: "Consumer Price Index" }],
};

const MOCK_RELEASE_DATES = {
  release_dates: [
    { release_id: 10, date: "2026-04-11" },
    { release_id: 10, date: "2026-05-13" },
  ],
};

beforeEach(() => {
  mockGetJson.mockReset();
  delete process.env.FRED_API_KEY;
});

describe("getSeries", () => {
  it("returns null when FRED_API_KEY is not set", async () => {
    const result = await getSeries("CPIAUCSL");
    expect(result).toBeNull();
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("resolves CPI shorthand to CPIAUCSL and fetches correct series", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_SERIES_META)   // series metadata call
      .mockResolvedValueOnce(MOCK_OBSERVATIONS);  // observations call

    const result = await getSeries("CPI");

    expect(result).not.toBeNull();
    expect(result!.seriesId).toBe("CPIAUCSL");

    // Both calls should use the resolved series ID
    const [metaCall, obsCall] = mockGetJson.mock.calls;
    expect((metaCall[1] as { params: Record<string,string> }).params.series_id).toBe("CPIAUCSL");
    expect((obsCall[1] as { params: Record<string,string> }).params.series_id).toBe("CPIAUCSL");
  });

  it("maps series metadata fields correctly", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_SERIES_META)
      .mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const result = await getSeries("CPIAUCSL");

    expect(result).toMatchObject({
      seriesId: "CPIAUCSL",
      title: "Consumer Price Index for All Urban Consumers: All Items",
      frequency: "M",
      units: "Index 1982-1984=100",
      source: "fred",
    });
  });

  it("filters out '.' observation values (missing data)", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_SERIES_META)
      .mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const result = await getSeries("CPIAUCSL");

    expect(result!.observations).toHaveLength(3); // 4 raw - 1 missing
    expect(result!.observations!.every((o) => typeof o.value === "number")).toBe(true);
    expect(result!.observations!.some((o) => (o.value as unknown) === ".")).toBe(false);
  });

  it("parses observation values as numbers", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_SERIES_META)
      .mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const result = await getSeries("CPIAUCSL");
    const obs = result!.observations!;

    expect(obs[0]).toEqual({ date: "2026-02-01", value: 314.3 });
    expect(obs[1]).toEqual({ date: "2026-01-01", value: 313.9 });
    expect(obs[2]).toEqual({ date: "2025-11-01", value: 312.4 });
  });

  it("requests observations in descending order with the given limit", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_SERIES_META)
      .mockResolvedValueOnce({ observations: [] });

    await getSeries("CPIAUCSL", 6);

    const obsCallParams = (mockGetJson.mock.calls[1][1] as { params: Record<string, string> }).params;
    expect(obsCallParams.sort_order).toBe("desc");
    expect(obsCallParams.limit).toBe("6");
  });

  it("returns null when series metadata call returns empty", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson.mockResolvedValueOnce({ seriess: [] });

    const result = await getSeries("UNKNOWN_SERIES");
    expect(result).toBeNull();
  });

  it("passes through unknown series IDs that are not in the shorthand map", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce({
        seriess: [{
          id: "MYSERIESID",
          title: "My Custom Series",
          frequency_short: "Q",
          units: "Billions",
          last_updated: "2026-01-01",
        }],
      })
      .mockResolvedValueOnce({ observations: [] });

    const result = await getSeries("MYSERIESID");

    const metaCallParams = (mockGetJson.mock.calls[0][1] as { params: Record<string, string> }).params;
    expect(metaCallParams.series_id).toBe("MYSERIESID");
    expect(result!.seriesId).toBe("MYSERIESID");
  });
});

describe("searchSeries", () => {
  it("returns empty array when FRED_API_KEY is not set", async () => {
    const result = await searchSeries("consumer price index");
    expect(result).toEqual([]);
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("maps search results to FredSeries array without observations", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson.mockResolvedValueOnce(MOCK_SEARCH_RESULTS);

    const result = await searchSeries("consumer price index");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      seriesId: "CPIAUCSL",
      title: "Consumer Price Index for All Urban Consumers: All Items",
      frequency: "M",
      units: "Index 1982-1984=100",
      source: "fred",
    });
    expect(result[0].observations).toBeUndefined();
  });

  it("passes search text and limit to the API", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson.mockResolvedValueOnce(MOCK_SEARCH_RESULTS);

    await searchSeries("unemployment rate", 5);

    const callParams = (mockGetJson.mock.calls[0][1] as { params: Record<string, string> }).params;
    expect(callParams.search_text).toBe("unemployment rate");
    expect(callParams.limit).toBe("5");
  });

  it("returns empty array when API returns no results", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson.mockResolvedValueOnce({ seriess: [] });

    const result = await searchSeries("zzz-no-match");
    expect(result).toEqual([]);
  });
});

describe("getReleaseDates", () => {
  it("returns empty array when FRED_API_KEY is not set", async () => {
    const result = await getReleaseDates("CPI");
    expect(result).toEqual([]);
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("resolves shorthand before fetching release info", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_RELEASE_INFO)
      .mockResolvedValueOnce(MOCK_RELEASE_DATES);

    await getReleaseDates("CPI");

    const releaseCallParams = (mockGetJson.mock.calls[0][1] as { params: Record<string, string> }).params;
    expect(releaseCallParams.series_id).toBe("CPIAUCSL");
  });

  it("returns FredRelease array with correct shape", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson
      .mockResolvedValueOnce(MOCK_RELEASE_INFO)
      .mockResolvedValueOnce(MOCK_RELEASE_DATES);

    const result = await getReleaseDates("CPI");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      seriesId: "CPIAUCSL",
      releaseName: "Consumer Price Index",
      releaseDate: "2026-04-11",
      source: "fred",
    });
    expect(result[1].releaseDate).toBe("2026-05-13");
  });

  it("returns empty array when release info lookup fails", async () => {
    process.env.FRED_API_KEY = "test-key";
    mockGetJson.mockResolvedValueOnce({ releases: [] });

    const result = await getReleaseDates("CPIAUCSL");
    expect(result).toEqual([]);
    // Should not attempt the second call
    expect(mockGetJson).toHaveBeenCalledTimes(1);
  });
});
