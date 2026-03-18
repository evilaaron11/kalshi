// Single source of truth for API endpoints, timeouts, and constants.

// --- Kalshi ---
export const KALSHI_HOST = "https://api.elections.kalshi.com";
export const KALSHI_API_PATH = "/trade-api/v2";
export const KALSHI_REQUEST_TIMEOUT = 10_000; // ms

// --- FEC ---
export const FEC_API_BASE = "https://api.open.fec.gov/v1";
export const FEC_DEFAULT_API_KEY = "DEMO_KEY";
export const FEC_REQUEST_TIMEOUT = 30_000;
export const FEC_PER_PAGE_LIMIT = 20;

// --- Federal Register & OIRA ---
export const FEDERAL_REGISTER_API =
  "https://www.federalregister.gov/api/v1/documents.json";
export const FEDERAL_REGISTER_TIMEOUT = 15_000;
export const OIRA_PUBLICATION_ID = "202504"; // Spring 2025 — update semi-annually
export const OIRA_XML_URL = `https://www.reginfo.gov/public/do/XMLViewFileAction?f=REGINFO_RIN_DATA_${OIRA_PUBLICATION_ID}.xml`;
export const OIRA_REQUEST_TIMEOUT = 60_000;

// --- Polling ---
export const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
export const RCP_LATEST =
  "https://www.realclearpolitics.com/epolls/latest_polls/";
export const WIKIPEDIA_SEARCH_LIMIT = 5;
export const RCP_REQUEST_TIMEOUT = 15_000;

// --- White House ---
export const WHITEHOUSE_FEEDS: Record<string, string> = {
  eos: "https://www.whitehouse.gov/presidential-actions/feed/",
  briefings:
    "https://www.whitehouse.gov/briefing-room/press-briefings/feed/",
  statements:
    "https://www.whitehouse.gov/briefing-room/statements-releases/feed/",
};
export const WHITEHOUSE_MAX_FEED_ITEMS = 30;
export const WHITEHOUSE_MAX_TEXT_CHARS = 8000;
export const WHITEHOUSE_REQUEST_DELAY = 400; // ms

// --- Cross-Market ---
export const POLYMARKET_API_BASE = "https://gamma-api.polymarket.com";
export const POLYMARKET_REQUEST_TIMEOUT = 15_000;
export const POLYMARKET_SEARCH_LIMIT = 5;
export const METACULUS_API_BASE = "https://www.metaculus.com/api";
export const METACULUS_REQUEST_TIMEOUT = 15_000;
export const METACULUS_SEARCH_LIMIT = 5;

// --- HTTP defaults ---
export const DEFAULT_USER_AGENT = "kalshi-analyst/1.0";
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate",
  Referer: "https://www.google.com/",
};

// --- Pipeline models ---
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";
