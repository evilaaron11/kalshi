"""Curated market watchlist — persisted as JSON."""

from __future__ import annotations

import json
from pathlib import Path

WATCHLIST_PATH = Path(__file__).parent / "watchlist.json"


def load_watchlist() -> list[str]:
    """Return list of tickers/URLs the user is tracking."""
    if not WATCHLIST_PATH.exists():
        return []
    return json.loads(WATCHLIST_PATH.read_text())


def save_watchlist(tickers: list[str]) -> None:
    WATCHLIST_PATH.write_text(json.dumps(tickers, indent=2))


def add_to_watchlist(ticker: str) -> list[str]:
    tickers = load_watchlist()
    if ticker not in tickers:
        tickers.append(ticker)
        save_watchlist(tickers)
    return tickers


def remove_from_watchlist(ticker: str) -> list[str]:
    tickers = load_watchlist()
    tickers = [t for t in tickers if t != ticker]
    save_watchlist(tickers)
    return tickers
