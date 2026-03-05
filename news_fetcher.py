import sys
import json
import os
import time
import argparse
from datetime import datetime, timezone
import requests
import feedparser
from dotenv import load_dotenv

load_dotenv()

BRAVE_LLM_CONTEXT_BASE = "https://api.search.brave.com/res/v1/llm/context"
MAX_ARTICLES = 15

RSS_FEEDS = [
    # Politics
    ("Reuters Politics", "https://feeds.reuters.com/reuters/politicsNews"),
    ("AP Politics", "https://feeds.apnews.com/rss/politics"),
    ("Politico", "https://rss.politico.com/politics-news.xml"),
    ("The Hill", "https://thehill.com/feed"),
    ("Fox News Politics", "https://feeds.foxnews.com/foxnews/politics"),
    ("NPR Politics", "https://feeds.npr.org/1014/rss.xml"),
    # Finance & Economy
    ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
    ("CNBC Markets", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
    # Culture & Entertainment
    ("Variety", "https://variety.com/feed/"),
    ("Deadline", "https://deadline.com/feed/"),
    ("Hollywood Reporter", "https://www.hollywoodreporter.com/feed/"),
    ("Rolling Stone", "https://www.rollingstone.com/feed/"),
    # Tech (light coverage)
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Ars Technica", "http://feeds.arstechnica.com/arstechnica/index"),
]

def fetch_brave_llm_context(queries: list[str]) -> list[dict]:
    """Fetch web content via Brave LLM Context API — returns extracted article text
    optimized for model consumption, not just meta description snippets."""
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        return []

    articles = []
    seen_urls = set()

    for i, query in enumerate(queries):
        if i > 0:
            time.sleep(0.1)  # Stay well under the 50 req/s limit
        try:
            resp = requests.get(
                BRAVE_LLM_CONTEXT_BASE,
                headers={
                    "X-Subscription-Token": api_key,
                    "Accept": "application/json",
                },
                params={
                    "q": query,
                    "country": "US",
                    "search_lang": "en",
                    "context_threshold_mode": "balanced",
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            # sources is a dict keyed by URL; age is [human-readable, ISO date, relative]
            source_meta = data.get("sources", {})

            # Extract articles from grounding.generic[]
            for item in data.get("grounding", {}).get("generic", []):
                url = item.get("url", "")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)

                meta = source_meta.get(url, {})
                age = meta.get("age", [])
                published = age[1] if isinstance(age, list) and len(age) > 1 else ""

                snippets = item.get("snippets", [])
                snippet_text = " … ".join(snippets)[:3000] if snippets else ""

                articles.append({
                    "title": item.get("title") or meta.get("title", ""),
                    "source": meta.get("hostname", "Brave Search"),
                    "published": published,
                    "snippet": snippet_text,
                    "url": url,
                })
        except Exception as e:
            print(f"Brave LLM Context error for query '{query}': {e}", file=sys.stderr)

    return articles



def parse_rss_date(entry) -> str:
    """Parse published date from RSS entry, return ISO string."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            pass
    return ""


def query_matches(text: str, query: str) -> bool:
    """Return True if the article text is relevant to the query.

    Matches if the full query phrase appears, or if at least 2 significant
    words from the query appear (prevents single-word false positives).
    """
    text_lower = text.lower()
    query_lower = query.lower()

    if query_lower in text_lower:
        return True

    words = [w for w in query_lower.split() if len(w) > 3]
    if not words:
        return False
    if len(words) == 1:
        return words[0] in text_lower

    matches = sum(1 for w in words if w in text_lower)
    return matches >= 2


def fetch_rss_feeds(queries: list[str]) -> list[dict]:
    """Fetch all RSS feeds and filter entries that match any query."""
    articles = []
    seen_urls = set()

    for source_name, feed_url in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                url = entry.get("link", "")
                text = title + " " + summary

                if any(query_matches(text, q) for q in queries):
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        articles.append({
                            "title": title,
                            "source": source_name,
                            "published": parse_rss_date(entry),
                            "snippet": summary[:300] if summary else "",
                            "url": url,
                        })
        except Exception as e:
            print(f"RSS error for {source_name}: {e}", file=sys.stderr)

    return articles


def sort_and_deduplicate(articles: list[dict]) -> list[dict]:
    """Deduplicate by URL, sort by date descending, return top MAX_ARTICLES."""
    seen = set()
    unique = []
    for a in articles:
        url = a.get("url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(a)

    def sort_key(a):
        pub = a.get("published", "")
        return pub if pub else "0"

    unique.sort(key=sort_key, reverse=True)
    return unique[:MAX_ARTICLES]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch news articles for Kalshi market analysis.")
    parser.add_argument("queries", nargs="+", help="Search queries")
    args = parser.parse_args()

    brave_articles = fetch_brave_llm_context(args.queries)
    rss_articles = fetch_rss_feeds(args.queries)

    all_articles = brave_articles + rss_articles
    final = sort_and_deduplicate(all_articles)

    print(json.dumps(final, indent=2))
