import sys
import json
import os
import time
import base64
import requests
from urllib.parse import urlparse
from dotenv import load_dotenv
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

load_dotenv()

KALSHI_HOST = "https://api.elections.kalshi.com"
KALSHI_API_PATH = "/trade-api/v2"


def load_private_key():
    key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH", "./kalshi_private.pem")
    key_path = os.path.expanduser(key_path)
    if not os.path.exists(key_path):
        raise FileNotFoundError(
            f"Private key not found at: {key_path}\n"
            "Save your Kalshi private key as a .pem file and set KALSHI_PRIVATE_KEY_PATH in .env"
        )
    with open(key_path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def build_auth_headers(method: str, path: str) -> dict:
    """Build Kalshi RSA-signed request headers."""
    api_key = os.getenv("KALSHI_API_KEY")
    if not api_key:
        raise EnvironmentError("KALSHI_API_KEY not set in .env")

    private_key = load_private_key()
    timestamp_ms = str(int(time.time() * 1000))
    message = f"{timestamp_ms}{method.upper()}{path}".encode("utf-8")
    signature = private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    signature_b64 = base64.b64encode(signature).decode("utf-8")

    return {
        "KALSHI-ACCESS-KEY": api_key,
        "KALSHI-ACCESS-TIMESTAMP": timestamp_ms,
        "KALSHI-ACCESS-SIGNATURE": signature_b64,
        "Accept": "application/json",
    }


def parse_ticker(url: str) -> str:
    """Extract ticker from a Kalshi market URL or return as-is if already a ticker.

    Handles both short URLs (/markets/TICKER) and long URLs
    (/markets/event/slug/TICKER) by always taking the last path segment.
    """
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https"):
        path_parts = [p for p in parsed.path.split("/") if p]
        if "markets" in path_parts:
            # Always use the last segment — it's the market ticker in all URL formats
            return path_parts[-1].upper()
        raise ValueError(f"Could not parse ticker from URL: {url}")
    return url.upper()


def cents_to_prob(val):
    return round(val / 100, 4) if val is not None else None


def parse_market(market: dict, ticker: str = "") -> dict:
    return {
        "ticker": market.get("ticker", ticker),
        "title": market.get("title", ""),
        "subtitle": market.get("subtitle", ""),
        "resolution_criteria": (
            market.get("rules_primary", "") + "\n" + market.get("rules_secondary", "")
        ).strip(),
        "event_ticker": market.get("event_ticker", ""),
        "yes_price": cents_to_prob(market.get("yes_ask")),
        "no_price": cents_to_prob(market.get("no_ask")),
        "yes_bid": cents_to_prob(market.get("yes_bid")),
        "volume": market.get("volume", 0),
        "open_interest": market.get("open_interest", 0),
        "close_date": market.get("close_time") or market.get("expected_expiration_time", ""),
        "status": market.get("status", ""),
    }


def fetch_market(ticker: str) -> dict:
    path = f"{KALSHI_API_PATH}/markets/{ticker}"
    headers = build_auth_headers("GET", path)
    response = requests.get(f"{KALSHI_HOST}{path}", headers=headers, timeout=10)

    if response.status_code == 404:
        # Might be an event ticker — try listing markets under it
        event_markets = fetch_event_markets(ticker)
        if event_markets:
            return {"type": "event", "event_ticker": ticker, "markets": event_markets}
        raise ValueError(f"No market or event found for ticker: {ticker}")
    if response.status_code in (401, 403):
        raise PermissionError(
            f"Authentication failed (HTTP {response.status_code}): {response.text}"
        )
    if not response.ok:
        raise RuntimeError(f"API error (HTTP {response.status_code}): {response.text}")

    data = response.json()
    return parse_market(data.get("market", data), ticker)


def fetch_event_markets(event_ticker: str, top_n: int = 3) -> list:
    """Return the top N markets under an event ticker, sorted by yes_price descending."""
    path = f"{KALSHI_API_PATH}/markets"
    headers = build_auth_headers("GET", path)
    response = requests.get(
        f"{KALSHI_HOST}{path}",
        headers=headers,
        params={"limit": 50, "event_ticker": event_ticker},
        timeout=10,
    )
    if not response.ok:
        return []
    markets = [parse_market(m) for m in response.json().get("markets", [])]
    # Sort by yes_price descending, filter out None prices
    markets.sort(key=lambda m: m.get("yes_price") or 0, reverse=True)
    return markets[:top_n]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python kalshi_client.py <market_url_or_ticker>", file=sys.stderr)
        sys.exit(1)

    try:
        ticker = parse_ticker(sys.argv[1])
        market = fetch_market(ticker)
        sys.stdout.buffer.write((json.dumps(market, indent=2) + "\n").encode("utf-8"))
    except Exception as e:
        sys.stderr.buffer.write((json.dumps({"error": str(e)}) + "\n").encode("utf-8"))
        sys.exit(1)
