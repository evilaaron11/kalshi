import fs from "fs";
import path from "path";

const WATCHLIST_PATH = path.join(process.cwd(), "data", "watchlist.json");

function ensureDir() {
  const dir = path.dirname(WATCHLIST_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadWatchlist(): string[] {
  try {
    return JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf-8"));
  } catch {
    return [];
  }
}

export function saveWatchlist(tickers: string[]): void {
  ensureDir();
  fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(tickers, null, 2));
}

export function addToWatchlist(ticker: string): string[] {
  const tickers = loadWatchlist();
  if (!tickers.includes(ticker)) {
    tickers.push(ticker);
    saveWatchlist(tickers);
  }
  return tickers;
}

export function removeFromWatchlist(ticker: string): string[] {
  const tickers = loadWatchlist().filter((t) => t !== ticker);
  saveWatchlist(tickers);
  return tickers;
}
