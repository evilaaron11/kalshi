import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  KALSHI_HOST,
  KALSHI_API_PATH,
  KALSHI_REQUEST_TIMEOUT,
} from "./config";
import type { ParsedMarket, EventData, MarketData } from "./types";

// --- Auth ---

let _privateKey: crypto.KeyObject | null = null;

function loadPrivateKey(): crypto.KeyObject {
  if (_privateKey) return _privateKey;
  const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
  if (!keyPath) throw new Error("KALSHI_PRIVATE_KEY_PATH not set");
  const resolved = keyPath.startsWith("~")
    ? path.join(process.env.HOME || process.env.USERPROFILE || "", keyPath.slice(1))
    : keyPath;
  const pem = fs.readFileSync(resolved, "utf-8");
  _privateKey = crypto.createPrivateKey(pem);
  return _privateKey;
}

function buildAuthHeaders(
  method: string,
  apiPath: string,
): Record<string, string> {
  const apiKey = process.env.KALSHI_API_KEY;
  if (!apiKey) throw new Error("KALSHI_API_KEY not set");

  const timestampMs = Date.now().toString();
  const message = timestampMs + method.toUpperCase() + apiPath;

  const key = loadPrivateKey();
  const signature = crypto
    .sign("sha256", Buffer.from(message), {
      key,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    })
    .toString("base64");

  return {
    "KALSHI-ACCESS-KEY": apiKey,
    "KALSHI-ACCESS-TIMESTAMP": timestampMs,
    "KALSHI-ACCESS-SIGNATURE": signature,
    "Content-Type": "application/json",
  };
}

// --- Helpers ---

/** Convert a dollar-string price (e.g. "0.6500") to a probability float. */
function dollarsToProbability(val: unknown): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : Math.round(n * 10000) / 10000;
}

/** Extract ticker from a Kalshi URL or return as-is if already a ticker. */
export function parseTicker(urlOrTicker: string): string {
  const trimmed = urlOrTicker.trim();

  // Full URL: extract last path segment
  if (trimmed.includes("kalshi.com")) {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return last.toUpperCase();
  }

  return trimmed.toUpperCase();
}

function parseMarketResponse(raw: Record<string, unknown>): ParsedMarket {
  const m = raw as Record<string, unknown>;

  // New API uses *_dollars (string) fields; fall back to legacy cent integers
  const price = (newKey: string, oldKey: string): number => {
    if (newKey in m) return dollarsToProbability(m[newKey]);
    const old = m[oldKey] as number | undefined;
    return old != null ? Math.round((old / 100) * 10000) / 10000 : 0;
  };

  const numericField = (newKey: string, oldKey: string): number => {
    if (newKey in m) {
      const v = parseFloat(m[newKey] as string);
      return isNaN(v) ? 0 : v;
    }
    return (m[oldKey] as number) || 0;
  };

  return {
    ticker: (m.ticker as string) || "",
    title: (m.title as string) || "",
    subtitle: (m.subtitle as string) || "",
    yesSubTitle: (m.yes_sub_title as string) || "",
    resolutionCriteria: [m.rules_primary || "", m.rules_secondary || ""]
      .filter(Boolean)
      .join("\n\n"),
    eventTicker: (m.event_ticker as string) || "",
    yesPrice: price("yes_ask_dollars", "yes_ask"),
    noPrice: price("no_ask_dollars", "no_ask"),
    yesBid: price("yes_bid_dollars", "yes_bid"),
    volume: numericField("volume_fp", "volume"),
    openInterest: numericField("open_interest_fp", "open_interest"),
    closeDate: (m.close_time as string) || (m.expected_expiration_time as string) || "",
    status: (m.status as string) || "",
  };
}

// --- API calls ---

async function kalshiGet<T>(apiPath: string): Promise<T> {
  const headers = buildAuthHeaders("GET", apiPath);
  const resp = await fetch(`${KALSHI_HOST}${apiPath}`, {
    headers,
    signal: AbortSignal.timeout(KALSHI_REQUEST_TIMEOUT),
  });

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`Kalshi auth error (${resp.status})`);
    }
    if (resp.status === 404) {
      throw new KalshiNotFoundError(apiPath);
    }
    throw new Error(`Kalshi API error: ${resp.status} ${resp.statusText}`);
  }

  return resp.json() as Promise<T>;
}

export class KalshiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = "KalshiNotFoundError";
  }
}

/** Fetch event-level info (series_ticker, title). */
async function fetchEventInfo(
  eventTicker: string,
): Promise<{ seriesTicker: string; title: string }> {
  const data = await kalshiGet<{ event: Record<string, unknown> }>(
    `${KALSHI_API_PATH}/events/${eventTicker}`,
  );
  const ev = data.event;
  return {
    seriesTicker: (ev.series_ticker as string) || "",
    title: (ev.title as string) || "",
  };
}

/** Fetch a single binary market. */
async function fetchSingleMarket(ticker: string): Promise<ParsedMarket> {
  const data = await kalshiGet<{ market: Record<string, unknown> }>(
    `${KALSHI_API_PATH}/markets/${ticker}`,
  );
  return parseMarketResponse(data.market);
}

/** Fetch all markets for a multi-outcome event. */
async function fetchEventMarkets(
  eventTicker: string,
  minYesPrice = 0.05,
): Promise<{ qualifying: ParsedMarket[]; subThreshold: ParsedMarket[] }> {
  const data = await kalshiGet<{ markets: Record<string, unknown>[] }>(
    `${KALSHI_API_PATH}/markets?limit=100&event_ticker=${eventTicker}`,
  );

  const all = (data.markets || [])
    .map(parseMarketResponse)
    .filter((m) => m.status !== "finalized");

  const qualifying = all
    .filter((m) => m.yesPrice >= minYesPrice)
    .sort((a, b) => b.yesPrice - a.yesPrice);

  const subThreshold = all
    .filter((m) => m.yesPrice > 0 && m.yesPrice < minYesPrice)
    .sort((a, b) => b.yesPrice - a.yesPrice);

  // Fallback: if no qualifying, return all non-finalized
  if (qualifying.length === 0) {
    return { qualifying: all, subThreshold: [] };
  }

  return { qualifying, subThreshold };
}

/**
 * Fetch market data by ticker. Returns ParsedMarket for binary,
 * EventData for multi-outcome events.
 */
export async function fetchMarket(ticker: string): Promise<MarketData> {
  try {
    const market = await fetchSingleMarket(ticker);
    // For binary markets, fetch event info for the Kalshi URL
    if (market.eventTicker) {
      try {
        const info = await fetchEventInfo(market.eventTicker);
        market.seriesTicker = info.seriesTicker;
        market.eventTitle = info.title;
      } catch {
        // Non-critical — URL will just be missing
      }
    }
    return market;
  } catch (err) {
    if (err instanceof KalshiNotFoundError) {
      // Might be an event ticker — try fetching as event
      const [{ qualifying, subThreshold }, eventInfo] = await Promise.all([
        fetchEventMarkets(ticker),
        fetchEventInfo(ticker).catch(() => ({ seriesTicker: "", title: "" })),
      ]);
      if (qualifying.length === 0) {
        throw new Error(`No active markets found for event ${ticker}`);
      }
      return {
        type: "event",
        title: eventInfo.title || qualifying[0].title,
        seriesTicker: eventInfo.seriesTicker,
        eventTitle: eventInfo.title,
        markets: qualifying,
        subThresholdMarkets: subThreshold,
      } as EventData;
    }
    throw err;
  }
}
