"""Configuration for all external API integrations."""

import os

# Kalshi
KALSHI_HOST = "https://api.elections.kalshi.com"
KALSHI_API_PATH = "/trade-api/v2"
KALSHI_REQUEST_TIMEOUT = 10

# FEC
FEC_API_BASE = "https://api.open.fec.gov/v1"
FEC_DEFAULT_API_KEY = "DEMO_KEY"
FEC_REQUEST_TIMEOUT = 15
FEC_PER_PAGE_LIMIT = 20

# Federal Register
FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json"
FEDERAL_REGISTER_TIMEOUT = 15

# OIRA Unified Agenda
# Published semi-annually (Spring=04, Fall=10). Update when a new edition is released.
OIRA_PUBLICATION_ID = "202504"
OIRA_XML_URL = f"https://www.reginfo.gov/public/do/XMLViewFileAction?f=REGINFO_RIN_DATA_{OIRA_PUBLICATION_ID}.xml"
OIRA_REQUEST_TIMEOUT = 60

# Polling
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
RCP_LATEST = "https://www.realclearpolitics.com/epolls/latest_polls/"
WIKIPEDIA_SEARCH_LIMIT = 5
RCP_REQUEST_TIMEOUT = 15

# White House
WHITEHOUSE_FEEDS = {
    "eos": "https://www.whitehouse.gov/presidential-actions/feed/",
    "briefings": "https://www.whitehouse.gov/briefing-room/press-briefings/feed/",
    "statements": "https://www.whitehouse.gov/briefing-room/statements-releases/feed/",
}
WHITEHOUSE_MAX_FEED_ITEMS = 30
WHITEHOUSE_MAX_TEXT_CHARS = 8000
WHITEHOUSE_REQUEST_DELAY = 0.4

# Polymarket (no auth required)
POLYMARKET_API_BASE = "https://gamma-api.polymarket.com"
POLYMARKET_REQUEST_TIMEOUT = 15
POLYMARKET_SEARCH_LIMIT = 5

# Metaculus (requires API token)
METACULUS_API_BASE = "https://www.metaculus.com/api"
METACULUS_REQUEST_TIMEOUT = 15
METACULUS_SEARCH_LIMIT = 5

# Shared defaults
DEFAULT_USER_AGENT = "kalshi-analyst/1.0"
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Referer": "https://www.google.com/",
}
