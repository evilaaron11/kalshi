# Kalshi Market Analyst

A multi-agent pipeline for analyzing [Kalshi](https://kalshi.com) prediction markets. Fetches live market data, gathers news, runs four parallel research subagents, and synthesizes a calibrated probability estimate with a betting recommendation.

## How it works

```
/analyze-market <url>
      │
      ├── kalshi_client.py   →  fetch market data + prices
      ├── news_fetcher.py    →  NewsAPI + RSS articles
      │
      ├── [parallel]
      │   ├── Evidence Agent (haiku)         factual state of play
      │   ├── Devil's Advocate (haiku)       contrarian case
      │   ├── Resolution Agent (sonnet)      criteria & edge cases
      │   └── Chaos Agent (haiku)            tail risks 1–8%
      │
      └── Calibrator (sonnet)  →  final report + edge + bet sizing
```

Supports both **single binary markets** and **multi-outcome events** (e.g. "Who will be Fed Chair?", "When will X happen?").

## Setup

**Requirements:** Python 3.10+, a Kalshi API key, optionally a NewsAPI key.

```bash
pip install requests cryptography python-dotenv feedparser
```

Create a `.env` file:

```
KALSHI_API_KEY=your_api_key_here
KALSHI_PRIVATE_KEY_PATH=./kalshi_private.pem
NEWS_API_KEY=your_newsapi_key_here   # optional but recommended
```

Place your Kalshi RSA private key at the path specified above.

## Usage

Run directly from [Claude Code](https://claude.ai/code):

```
/analyze-market https://kalshi.com/markets/SOMEEVENT-TICKER
```

Or with just the ticker:

```
/analyze-market SOMEEVENT-TICKER
```

You can also run the underlying scripts directly:

```bash
# Fetch market data
python kalshi_client.py https://kalshi.com/markets/SOMEEVENT-TICKER

# Fetch news articles
python news_fetcher.py "query one" "query two" "query three"
```

## Output

The Calibrator produces a structured report including:

- Estimated probability vs. market price (edge)
- Bull case / Bear case
- Tail risks worth monitoring
- Resolution watch (technical flags)
- Betting recommendation with Kelly-sized position sizing
- Full probability methodology

Results are saved to `results/YYYY-MM-DD_{TICKER}.md`.

## API keys

| Key | Required | Source |
|---|---|---|
| `KALSHI_API_KEY` + RSA private key | Yes | [Kalshi API settings](https://kalshi.com/profile/api) |
| `NEWS_API_KEY` | No (recommended) | [newsapi.org](https://newsapi.org) |

Without a NewsAPI key, the pipeline falls back to RSS feeds (Reuters, AP, Politico, The Hill, Fox News, NPR).
