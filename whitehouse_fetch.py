"""whitehouse_fetch.py — Fetch primary source content from whitehouse.gov

Retrieves full text of executive orders, press briefing transcripts, and
official statements. Returns primary source text, not article summaries.

Usage (callable by agents via Bash):
    python whitehouse_fetch.py --search "tariffs" --type eos
    python whitehouse_fetch.py --search "Ukraine ceasefire" --type briefings
    python whitehouse_fetch.py --search "DOGE" --type all --limit 5
    python whitehouse_fetch.py --type eos --limit 10          # most recent, no filter

Output: JSON array of { title, url, published, type, text }
"""

import sys
import json
import argparse
import time
import requests
import feedparser
from bs4 import BeautifulSoup

FEED_URLS = {
    "eos":        "https://www.whitehouse.gov/presidential-actions/feed/",
    "briefings":  "https://www.whitehouse.gov/briefing-room/press-briefings/feed/",
    "statements": "https://www.whitehouse.gov/briefing-room/statements-releases/feed/",
}

MAX_FEED_ITEMS = 30   # RSS items to scan per feed before giving up
MAX_TEXT_CHARS = 8000 # Truncate body text at this length
REQUEST_DELAY  = 0.4  # Seconds between page fetches — be polite

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; kalshi-analyst/1.0; research tool)",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch_page_text(url: str) -> str:
    """Fetch and extract article body text from a whitehouse.gov page."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove nav, header, footer, scripts, styles before extracting
        for tag in soup(["nav", "header", "footer", "script", "style", "aside"]):
            tag.decompose()

        # Try content containers in order of specificity
        for selector in [
            {"class": "body-content"},
            {"class": "entry-content"},
            {"class": "page-content"},
            {"class": "wp-block-group"},
        ]:
            el = soup.find("div", selector)
            if el:
                return el.get_text(separator="\n", strip=True)[:MAX_TEXT_CHARS]

        # Fall back to <article> tag
        article = soup.find("article")
        if article:
            return article.get_text(separator="\n", strip=True)[:MAX_TEXT_CHARS]

        # Last resort: join all <p> tags
        paragraphs = soup.find_all("p")
        return "\n".join(p.get_text(strip=True) for p in paragraphs)[:MAX_TEXT_CHARS]

    except Exception as e:
        print(f"Page fetch error ({url}): {e}", file=sys.stderr)
        return ""


def matches_query(text: str, query: str) -> bool:
    """Return True if text is relevant to query (phrase match or 2+ significant words)."""
    if not query:
        return True
    text_lower = text.lower()
    query_lower = query.lower()
    if query_lower in text_lower:
        return True
    words = [w for w in query_lower.split() if len(w) > 3]
    if not words:
        return query_lower in text_lower
    if len(words) == 1:
        return words[0] in text_lower
    return sum(1 for w in words if w in text_lower) >= 2


def fetch_feed(feed_type: str, query: str, limit: int) -> list[dict]:
    results = []
    feed = feedparser.parse(FEED_URLS[feed_type])

    for entry in feed.entries[:MAX_FEED_ITEMS]:
        title     = entry.get("title", "")
        summary   = entry.get("summary", "")
        link      = entry.get("link", "")
        published = entry.get("published", "")

        # Strip HTML from summary before matching (RSS summaries contain raw HTML)
        summary_text = BeautifulSoup(summary, "html.parser").get_text(" ", strip=True)

        # Quick title+summary check before paying for a full page fetch
        if not matches_query(title + " " + summary_text, query):
            continue

        text = fetch_page_text(link) if link else summary
        time.sleep(REQUEST_DELAY)

        # If the full page text is available, re-check relevance against it
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

    feed_types = list(FEED_URLS.keys()) if args.type == "all" else [args.type]

    results = []
    for feed_type in feed_types:
        try:
            results.extend(fetch_feed(feed_type, args.search, args.limit))
        except Exception as e:
            print(f"Feed error ({feed_type}): {e}", file=sys.stderr)

    sys.stdout.buffer.write((json.dumps(results, indent=2) + "\n").encode("utf-8"))
