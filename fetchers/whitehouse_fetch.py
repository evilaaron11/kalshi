"""whitehouse_fetch.py — Fetch primary source content from whitehouse.gov

Retrieves full text of executive orders, press briefing transcripts, and
official statements. Returns primary source text, not article summaries.

Usage (callable by agents via Bash):
    python -m fetchers.whitehouse_fetch --search "tariffs" --type eos
    python -m fetchers.whitehouse_fetch --search "Ukraine ceasefire" --type briefings
    python -m fetchers.whitehouse_fetch --search "DOGE" --type all --limit 5
    python -m fetchers.whitehouse_fetch --type eos --limit 10          # most recent, no filter

Output: JSON array of { title, url, published, type, text }
"""

import sys
import json
import argparse
import time
import feedparser
from bs4 import BeautifulSoup

from src.config import (
    WHITEHOUSE_FEEDS, WHITEHOUSE_MAX_FEED_ITEMS,
    WHITEHOUSE_MAX_TEXT_CHARS, WHITEHOUSE_REQUEST_DELAY,
)
from src import http_client
from src.text_utils import matches_query

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; kalshi-analyst/1.0; research tool)",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch_page_text(url: str) -> str:
    """Fetch and extract article body text from a whitehouse.gov page."""
    resp = http_client.get(url, headers=HEADERS, timeout=15)
    if not resp:
        return ""

    try:
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["nav", "header", "footer", "script", "style", "aside"]):
            tag.decompose()

        for selector in [
            {"class": "body-content"},
            {"class": "entry-content"},
            {"class": "page-content"},
            {"class": "wp-block-group"},
        ]:
            el = soup.find("div", selector)
            if el:
                return el.get_text(separator="\n", strip=True)[:WHITEHOUSE_MAX_TEXT_CHARS]

        article = soup.find("article")
        if article:
            return article.get_text(separator="\n", strip=True)[:WHITEHOUSE_MAX_TEXT_CHARS]

        paragraphs = soup.find_all("p")
        return "\n".join(p.get_text(strip=True) for p in paragraphs)[:WHITEHOUSE_MAX_TEXT_CHARS]

    except Exception as e:
        print(f"Page parse error ({url}): {e}", file=sys.stderr)
        return ""


def fetch_feed(feed_type: str, query: str, limit: int) -> list[dict]:
    results = []
    feed = feedparser.parse(WHITEHOUSE_FEEDS[feed_type])

    for entry in feed.entries[:WHITEHOUSE_MAX_FEED_ITEMS]:
        title     = entry.get("title", "")
        summary   = entry.get("summary", "")
        link      = entry.get("link", "")
        published = entry.get("published", "")

        summary_text = BeautifulSoup(summary, "html.parser").get_text(" ", strip=True)

        if not matches_query(title + " " + summary_text, query):
            continue

        text = fetch_page_text(link) if link else summary
        time.sleep(WHITEHOUSE_REQUEST_DELAY)

        if text and query and not matches_query(text, query):
            continue

        results.append({
            "title":     title,
            "url":       link,
            "published": published,
            "type":      feed_type,
            "text":      text or summary,
        })

        if len(results) >= limit:
            break

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Fetch primary source content from whitehouse.gov"
    )
    parser.add_argument("--search", default="",
                        help="Search query (blank = return most recent)")
    parser.add_argument("--type", choices=["eos", "briefings", "statements", "all"],
                        default="all", help="Content type to fetch")
    parser.add_argument("--limit", type=int, default=5,
                        help="Max results per feed type (default: 5)")
    args = parser.parse_args()

    feed_types = list(WHITEHOUSE_FEEDS.keys()) if args.type == "all" else [args.type]

    results = []
    for feed_type in feed_types:
        try:
            results.extend(fetch_feed(feed_type, args.search, args.limit))
        except Exception as e:
            print(f"Feed error ({feed_type}): {e}", file=sys.stderr)

    sys.stdout.buffer.write((json.dumps(results, indent=2) + "\n").encode("utf-8"))
