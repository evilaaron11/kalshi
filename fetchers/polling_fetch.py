"""polling_fetch.py — Polling averages for US electoral races

Two sources:
  1. Wikipedia election polling articles (via Wikipedia search API + HTML parsing)
     — Best for specific races: Senate, Governor, presidential primary, etc.
  2. RealClearPolitics latest polls listing (scraped)
     — Best for the generic congressional ballot and presidential head-to-head

NOT raw polls — returns the most recently reported average/aggregate where available.

Usage (callable by agents via Bash):
    python -m fetchers.polling_fetch --race "Georgia Senate 2026"
    python -m fetchers.polling_fetch --race "Wisconsin Governor 2026"
    python -m fetchers.polling_fetch --race "presidential 2028" --source wikipedia
    python -m fetchers.polling_fetch --source rcp                     # generic ballot + top races

Output: JSON array of { race, source_name, date, candidates, avg_or_latest, url }
"""

import sys
import json
import argparse
from bs4 import BeautifulSoup

from src.config import WIKIPEDIA_API, RCP_LATEST, RCP_REQUEST_TIMEOUT, BROWSER_HEADERS
from src import http_client
from src.text_utils import matches_query


# ---------------------------------------------------------------------------
# Wikipedia source
# ---------------------------------------------------------------------------

def wikipedia_search(query: str) -> list[dict]:
    """Search Wikipedia for polling articles matching the query."""
    params = {
        "action":   "query",
        "list":     "search",
        "srsearch": f"polling {query}",
        "srnamespace": 0,
        "srlimit":  5,
        "format":   "json",
    }
    resp = http_client.get(WIKIPEDIA_API, params=params,
                           headers=BROWSER_HEADERS, timeout=10)
    if not resp:
        return []
    hits = resp.json().get("query", {}).get("search", [])
    return hits[:3]


def fetch_wikipedia_polling(title: str) -> list[dict]:
    """Fetch a Wikipedia polling article and extract poll tables."""
    url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
    resp = http_client.get(url, headers=BROWSER_HEADERS, timeout=15)
    if not resp:
        return []

    try:
        soup = BeautifulSoup(resp.text, "html.parser")

        results = []
        for table in soup.find_all("table", class_="wikitable"):
            headers_row = table.find("tr")
            if not headers_row:
                continue
            col_headers = [th.get_text(strip=True) for th in headers_row.find_all(["th", "td"])]

            headers_joined = " ".join(col_headers).lower()
            if "poll" not in headers_joined:
                continue

            rows = []
            for tr in table.find_all("tr")[1:]:
                cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
                if cells and len(cells) >= 3:
                    row = dict(zip(col_headers[:len(cells)], cells))
                    rows.append(row)

            if rows:
                results.append({
                    "race":        title,
                    "source_name": "Wikipedia",
                    "url":         url,
                    "columns":     col_headers,
                    "polls":       rows[:25],
                })

        return results
    except Exception as e:
        print(f"Wikipedia fetch error ({title}): {e}", file=sys.stderr)
        return []


def query_wikipedia(race: str) -> list[dict]:
    hits = wikipedia_search(race)
    if not hits:
        return []
    title = hits[0]["title"]
    return fetch_wikipedia_polling(title)


# ---------------------------------------------------------------------------
# RealClearPolitics source
# ---------------------------------------------------------------------------

def fetch_rcp(race_filter: str = "") -> list[dict]:
    """Scrape RCP latest polls listing for current averages."""
    results = []
    resp = http_client.get(RCP_LATEST, headers=BROWSER_HEADERS, timeout=RCP_REQUEST_TIMEOUT)
    if not resp:
        return []

    try:
        soup = BeautifulSoup(resp.text, "html.parser")

        for row in soup.find_all("tr", attrs={"data-id": True}):
            td = row.find("td")
            if not td:
                continue

            title_link = td.find("a", href=True)
            if not title_link:
                continue
            race_name = title_link.find("span")
            race_name = race_name.get_text(strip=True) if race_name else title_link.get_text(strip=True)
            if not race_name:
                continue
            if race_filter and not matches_query(race_name, race_filter):
                continue

            href = title_link.get("href", "")
            race_url = ("https://www.realclearpolitics.com" + href
                        if href.startswith("/") else href)

            results.append({
                "race":        race_name,
                "source_name": "RealClearPolitics",
                "url":         race_url,
                "data":        td.get_text(" ", strip=True),
            })

    except Exception as e:
        print(f"RCP fetch error: {e}", file=sys.stderr)

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Polling averages for US electoral races")
    parser.add_argument("--race",   default="",
                        help="Race to look up (e.g. 'Georgia Senate 2026')")
    parser.add_argument("--source", choices=["both", "wikipedia", "rcp"], default="both",
                        help="Data source (default: both)")
    args = parser.parse_args()

    results = []

    if args.source in ("both", "wikipedia") and args.race:
        results.extend(query_wikipedia(args.race))

    if args.source in ("both", "rcp"):
        results.extend(fetch_rcp(args.race))

    sys.stdout.buffer.write((json.dumps(results, indent=2) + "\n").encode("utf-8"))
