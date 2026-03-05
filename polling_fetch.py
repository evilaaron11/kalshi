"""polling_fetch.py — Polling averages for US electoral races

Two sources:
  1. Wikipedia election polling articles (via Wikipedia search API + HTML parsing)
     — Best for specific races: Senate, Governor, presidential primary, etc.
  2. RealClearPolitics latest polls listing (scraped)
     — Best for the generic congressional ballot and presidential head-to-head

NOT raw polls — returns the most recently reported average/aggregate where available.

Usage (callable by agents via Bash):
    python polling_fetch.py --race "Georgia Senate 2026"
    python polling_fetch.py --race "Wisconsin Governor 2026"
    python polling_fetch.py --race "presidential 2028" --source wikipedia
    python polling_fetch.py --source rcp                     # generic ballot + top races

Output: JSON array of { race, source_name, date, candidates, avg_or_latest, url }
"""

import sys
import json
import argparse
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",  # no 'br' — requests can't decode Brotli natively
    "Referer": "https://www.google.com/",
}
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
RCP_LATEST    = "https://www.realclearpolitics.com/epolls/latest_polls/"


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
    try:
        resp = requests.get(WIKIPEDIA_API, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        hits = resp.json().get("query", {}).get("search", [])
        # Return top results — election articles contain polling sections even without "polling" in title
        return hits[:3]
    except Exception as e:
        print(f"Wikipedia search error: {e}", file=sys.stderr)
        return []


def fetch_wikipedia_polling(title: str) -> list[dict]:
    """Fetch a Wikipedia polling article and extract poll tables."""
    url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        results = []
        # Wikipedia polling tables are wikitables — find all of them
        for table in soup.find_all("table", class_="wikitable"):
            headers_row = table.find("tr")
            if not headers_row:
                continue
            col_headers = [th.get_text(strip=True) for th in headers_row.find_all(["th", "td"])]

            # Skip non-polling tables (finance, results, debates, endorsements)
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
    # Use the top result
    title = hits[0]["title"]
    return fetch_wikipedia_polling(title)


# ---------------------------------------------------------------------------
# RealClearPolitics source
# ---------------------------------------------------------------------------

def fetch_rcp(race_filter: str = "") -> list[dict]:
    """Scrape RCP latest polls listing for current averages."""
    results = []
    try:
        resp = requests.get(RCP_LATEST, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # RCP now uses one <tr data-id="..."> per race, each with a single <td>
        for row in soup.find_all("tr", attrs={"data-id": True}):
            td = row.find("td")
            if not td:
                continue

            # Race title is in the first <a> inside the row
            title_link = td.find("a", href=True)
            if not title_link:
                continue
            race_name = title_link.find("span")
            race_name = race_name.get_text(strip=True) if race_name else title_link.get_text(strip=True)
            if not race_name:
                continue
            if race_filter:
                rf = race_filter.lower()
                rn = race_name.lower()
                # Use words > 4 chars to skip generic tokens like "2026", "the"
                words = [w for w in rf.split() if len(w) > 4]
                threshold = min(2, len(words)) if words else 1
                if rf not in rn and not (words and sum(1 for w in words if w in rn) >= threshold):
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
