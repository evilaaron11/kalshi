"""cross_market.py — Cross-platform prediction market price comparison

Searches Polymarket and Metaculus for markets matching a query, returns
current prices for arbitrage detection.

Usage (callable by agents via Bash):
    python -m fetchers.cross_market --query "government shutdown"
    python -m fetchers.cross_market --query "Fed rate cut" --platforms polymarket,metaculus

Output: JSON array of { platform, title, probability, volume, url }
"""

import sys
import json
import os
import argparse
from dotenv import load_dotenv

from src.config import (
    POLYMARKET_API_BASE, POLYMARKET_REQUEST_TIMEOUT, POLYMARKET_SEARCH_LIMIT,
    METACULUS_API_BASE, METACULUS_REQUEST_TIMEOUT, METACULUS_SEARCH_LIMIT,
)
from src import http_client

load_dotenv()


def search_polymarket(query: str, limit: int = POLYMARKET_SEARCH_LIMIT) -> list[dict]:
    """Search Polymarket for matching markets. No auth required."""
    resp = http_client.get(
        f"{POLYMARKET_API_BASE}/public-search",
        params={"q": query, "limit_per_type": limit},
        timeout=POLYMARKET_REQUEST_TIMEOUT,
    )
    if not resp:
        return []

    data = resp.json()
    results = []
    for event in data.get("events", []):
        for market in event.get("markets", []):
            if market.get("closed"):
                continue
            try:
                prices = json.loads(market.get("outcomePrices", "[]"))
                yes_prob = float(prices[0]) if prices else None
            except (json.JSONDecodeError, IndexError, ValueError):
                yes_prob = None
            if yes_prob is None:
                continue

            results.append({
                "platform": "polymarket",
                "title": market.get("question") or market.get("groupItemTitle", ""),
                "probability": round(yes_prob, 4),
                "volume_usd": round(float(market.get("volume", 0)), 2),
                "url": f"https://polymarket.com/event/{event.get('slug', '')}",
            })
    return results


def search_metaculus(query: str, limit: int = METACULUS_SEARCH_LIMIT) -> list[dict]:
    """Search Metaculus for matching questions. Requires METACULUS_TOKEN env var."""
    token = os.getenv("METACULUS_TOKEN")
    if not token:
        print("METACULUS_TOKEN not set — skipping Metaculus", file=sys.stderr)
        return []

    resp = http_client.get(
        f"{METACULUS_API_BASE}/posts/",
        params={
            "search": query,
            "statuses": "open",
            "forecast_type": "binary",
            "limit": limit,
            "order_by": "-hotness",
            "with_cp": "true",
        },
        headers={"Authorization": f"Token {token}"},
        timeout=METACULUS_REQUEST_TIMEOUT,
    )
    if not resp:
        return []

    results = []
    for post in resp.json().get("results", []):
        question = post.get("question") or {}
        aggregations = question.get("aggregations", {})

        prob = None
        for agg_type in ("recency_weighted", "unweighted"):
            agg = aggregations.get(agg_type, {})
            latest = agg.get("latest", {})
            centers = latest.get("centers", [])
            if centers:
                prob = centers[0]
                break

        if prob is None:
            continue

        post_id = post.get("id", "")
        results.append({
            "platform": "metaculus",
            "title": post.get("title", ""),
            "probability": round(float(prob), 4),
            "forecasters": post.get("nr_forecasters", 0),
            "url": f"https://www.metaculus.com/questions/{post_id}/",
        })
    return results


PLATFORM_FUNCS = {
    "polymarket": search_polymarket,
    "metaculus": search_metaculus,
}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cross-market price comparison")
    parser.add_argument("--query", required=True, help="Search query (market topic)")
    parser.add_argument("--platforms", default="polymarket,metaculus",
                        help="Comma-separated platforms (default: polymarket,metaculus)")
    parser.add_argument("--limit", type=int, default=5, help="Max results per platform")
    args = parser.parse_args()

    platforms = [p.strip() for p in args.platforms.split(",")]
    all_results = []
    for platform in platforms:
        func = PLATFORM_FUNCS.get(platform)
        if not func:
            print(f"Unknown platform: {platform}", file=sys.stderr)
            continue
        all_results.extend(func(args.query, args.limit))

    sys.stdout.buffer.write((json.dumps(all_results, indent=2) + "\n").encode("utf-8"))
