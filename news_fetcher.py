import sys
import json
import os
from datetime import datetime, timezone
from urllib.parse import urlencode
import requests
import feedparser
from dotenv import load_dotenv

load_dotenv()

NEWSAPI_BASE = "https://newsapi.org/v2/everything"
MAX_ARTICLES = 15

RSS_FEEDS = [
    ("Reuters Politics", "https://feeds.reuters.com/reuters/politicsNews"),
    ("AP Politics", "https://feeds.apnews.com/rss/politics"),
    ("Politico", "https://rss.politico.com/politics-news.xml"),
    ("The Hill", "https://thehill.com/feed"),
    ("Fox News Politics", "https://feeds.foxnews.com/foxnews/politics"),
    ("NPR Politics", "https://feeds.npr.org/1014/rss.xml"),
]


def fetch_newsapi(queries: list[str]) -> list[dict]:
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        return []

    articles = []
    seen_urls = set()

    for query in queries:
        params = {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 10,
            "apiKey": api_key,
        }
        try:
            resp = requests.get(NEWSAPI_BASE, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            for a in data.get("articles", []):
                url = a.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    articles.append({
                        "title": a.get("title", ""),
                        "source": a.get("source", {}).get("name", "NewsAPI"),
                        "published": a.get("publishedAt", ""),
                        "snippet": a.get("description") or a.get("content", ""),
                        "url": url,
                    })
        except Exception as e:
            print(f"NewsAPI error for query '{query}': {e}", file=sys.stderr)

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


def fetch_rss_feeds(queries: list[str]) -> list[dict]:
    """Fetch all RSS feeds and filter entries that match any query term."""
    query_terms = set()
    for q in queries:
        for word in q.lower().split():
            if len(word) > 3:  # skip short words
                query_terms.add(word)

    articles = []
    seen_urls = set()

    for source_name, feed_url in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                url = entry.get("link", "")
                text = (title + " " + summary).lower()

                # Include if any query term appears in the article
                if any(term in text for term in query_terms):
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

    # Sort by published date descending (empty dates go last)
    def sort_key(a):
        pub = a.get("published", "")
        return pub if pub else "0"

    unique.sort(key=sort_key, reverse=True)
    return unique[:MAX_ARTICLES]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python news_fetcher.py <query1> [query2] ...", file=sys.stderr)
        sys.exit(1)

    queries = sys.argv[1:]

    newsapi_articles = fetch_newsapi(queries)
    rss_articles = fetch_rss_feeds(queries)

    all_articles = newsapi_articles + rss_articles
    final = sort_and_deduplicate(all_articles)

    print(json.dumps(final, indent=2))
