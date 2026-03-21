import { getJson } from "../httpClient";
import {
  FRED_API_BASE,
  FRED_REQUEST_TIMEOUT,
  FRED_DEFAULT_LIMIT,
  FRED_SERIES_MAP,
} from "../config";
import type { FredObservation, FredSeries, FredRelease } from "../types";

function getApiKey(): string | null {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    console.warn("[fred] FRED_API_KEY not set — skipping FRED fetch");
    return null;
  }
  return key;
}

/** Resolve a shorthand (e.g. "CPI") to a FRED series ID, or pass through if not in map. */
function resolveSeriesId(seriesIdOrShorthand: string): string {
  return FRED_SERIES_MAP[seriesIdOrShorthand.toUpperCase()] ?? seriesIdOrShorthand;
}

// --- FRED API response shapes ---

interface FredApiSeries {
  id: string;
  title: string;
  frequency_short: string;
  units: string;
  last_updated: string;
}

interface FredSeriesResponse {
  seriess?: FredApiSeries[];
}

interface FredObservationRaw {
  date: string;
  value: string;
}

interface FredObservationsResponse {
  observations?: FredObservationRaw[];
}

interface FredReleaseInfo {
  id: number;
  name: string;
}

interface FredReleaseResponse {
  releases?: FredReleaseInfo[];
}

interface FredReleaseDateRaw {
  release_id: number;
  date: string;
}

interface FredReleaseDatesResponse {
  release_dates?: FredReleaseDateRaw[];
}

/**
 * Fetch a FRED data series and its most recent observations.
 *
 * @param seriesIdOrShorthand - FRED series ID (e.g. "CPIAUCSL") or shorthand (e.g. "CPI")
 * @param limit - Number of observations to return (default: FRED_DEFAULT_LIMIT, newest first)
 * @returns FredSeries with observations, or null if API key is missing or request fails
 */
export async function getSeries(
  seriesIdOrShorthand: string,
  limit: number = FRED_DEFAULT_LIMIT,
): Promise<FredSeries | null> {
  const key = getApiKey();
  if (!key) return null;

  const seriesId = resolveSeriesId(seriesIdOrShorthand);

  // Fetch series metadata
  const metaData = await getJson<FredSeriesResponse>(
    `${FRED_API_BASE}/series`,
    {
      params: {
        series_id: seriesId,
        api_key: key,
        file_type: "json",
      },
      timeout: FRED_REQUEST_TIMEOUT,
    },
  );

  if (!metaData?.seriess?.length) return null;

  const meta = metaData.seriess[0];

  // Fetch observations (newest first)
  const obsData = await getJson<FredObservationsResponse>(
    `${FRED_API_BASE}/series/observations`,
    {
      params: {
        series_id: seriesId,
        api_key: key,
        file_type: "json",
        sort_order: "desc",
        limit: String(limit),
      },
      timeout: FRED_REQUEST_TIMEOUT,
    },
  );

  const observations: FredObservation[] = (obsData?.observations ?? [])
    .filter((obs) => obs.value !== ".")
    .map((obs) => ({
      date: obs.date,
      value: parseFloat(obs.value),
    }));

  return {
    seriesId: meta.id,
    title: meta.title,
    frequency: meta.frequency_short,
    units: meta.units,
    lastUpdated: meta.last_updated,
    observations,
    source: "fred",
  };
}

/**
 * Search FRED for series matching a keyword query.
 *
 * @param query - Search text (e.g. "consumer price index")
 * @param limit - Maximum number of series to return (default: FRED_DEFAULT_LIMIT)
 * @returns Array of matching FredSeries (without observations)
 */
export async function searchSeries(
  query: string,
  limit: number = FRED_DEFAULT_LIMIT,
): Promise<FredSeries[]> {
  const key = getApiKey();
  if (!key) return [];

  const data = await getJson<FredSeriesResponse>(
    `${FRED_API_BASE}/series/search`,
    {
      params: {
        search_text: query,
        api_key: key,
        file_type: "json",
        limit: String(limit),
      },
      timeout: FRED_REQUEST_TIMEOUT,
    },
  );

  if (!data?.seriess) return [];

  return data.seriess.map((s) => ({
    seriesId: s.id,
    title: s.title,
    frequency: s.frequency_short,
    units: s.units,
    lastUpdated: s.last_updated,
    source: "fred" as const,
  }));
}

/**
 * Get upcoming release dates for the release that a given FRED series belongs to.
 *
 * @param seriesIdOrShorthand - FRED series ID (e.g. "CPIAUCSL") or shorthand (e.g. "CPI")
 * @returns Array of FredRelease records for upcoming release dates
 */
export async function getReleaseDates(
  seriesIdOrShorthand: string,
): Promise<FredRelease[]> {
  const key = getApiKey();
  if (!key) return [];

  const seriesId = resolveSeriesId(seriesIdOrShorthand);

  // Step 1: look up which release this series belongs to
  const releaseData = await getJson<FredReleaseResponse>(
    `${FRED_API_BASE}/series/release`,
    {
      params: {
        series_id: seriesId,
        api_key: key,
        file_type: "json",
      },
      timeout: FRED_REQUEST_TIMEOUT,
    },
  );

  if (!releaseData?.releases?.length) return [];

  const release = releaseData.releases[0];

  // Step 2: fetch upcoming release dates for that release
  const today = new Date().toISOString().split("T")[0];
  const datesData = await getJson<FredReleaseDatesResponse>(
    `${FRED_API_BASE}/release/dates`,
    {
      params: {
        release_id: String(release.id),
        api_key: key,
        file_type: "json",
        realtime_start: today,
        sort_order: "asc",
        limit: "10",
      },
      timeout: FRED_REQUEST_TIMEOUT,
    },
  );

  if (!datesData?.release_dates) return [];

  return datesData.release_dates.map((rd) => ({
    seriesId,
    releaseName: release.name,
    releaseDate: rd.date,
    source: "fred" as const,
  }));
}
