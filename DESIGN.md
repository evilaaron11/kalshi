# Kalshi Prediction Assistant — Design Document

## Overview

A research assistant that helps evaluate Kalshi prediction markets. The user identifies markets where they believe they have an edge; the system fetches market data and relevant news, then runs a panel of Claude subagents to produce a structured probability estimate.

All AI analysis runs through Claude Code (Claude Pro subscription). No separate Anthropic API key required. Invoked via the `/analyze-market` custom slash command.

---

## Project Structure

```
kalshi/
├── .claude/
│   └── commands/
│       └── analyze-market.md    # /analyze-market slash command definition
├── results/
│   └── YYYY-MM-DD_TICKER.md     # one persisted report per analysis run
├── .env                         # API keys (never commit)
├── requirements.txt             # Python dependencies
├── kalshi_client.py             # Kalshi API wrapper
├── news_fetcher.py              # NewsAPI + RSS aggregator
└── DESIGN.md                    # This file
```

---

## Invocation

From within this project directory in Claude Code, the user types:

```
/analyze-market https://kalshi.com/markets/TRUMPBUDGET-25MAR01
```

Claude Code reads `.claude/commands/analyze-market.md`, which contains the full orchestration instructions, and executes the pipeline automatically.

---

## Runtime Flow

```
/analyze-market <URL>
            │
            ▼
  kalshi_client.py
  → parse ticker from URL
  → GET /markets/{ticker}
  → output: title, description, resolution criteria,
            yes_price, close_date, volume
            │
            ▼
  Claude Code generates 3-5 search queries
  from market title + resolution criteria
            │
            ▼
  news_fetcher.py <query1> <query2> ...
  → fetch NewsAPI (keyword search, sorted by recency)
  → fetch RSS feeds (Reuters, AP, Politico, The Hill,
                     Fox News Politics, NPR)
  → deduplicate, rank by recency
  → output: top 15 articles (title, source, date, snippet, url)
            │
            ▼
  ┌─────────────────────────────────────────┐
  │         Parallel Subagents              │
  │                                         │
  │  [Evidence Agent]    model: haiku       │
  │  [Devil's Advocate]  model: sonnet      │
  │  [Resolution Agent]  model: sonnet      │
  └─────────────────────────────────────────┘
            │
            ▼
  [Calibrator Agent]    model: opus
  → reads all three subagent outputs
  → produces final report
            │
            ▼
  Report displayed in Claude Code chat
  Report saved to results/YYYY-MM-DD_TICKER.md
```

---

## Python Scripts

### `kalshi_client.py`
- Accepts a Kalshi market URL as a CLI argument
- Parses the ticker from the URL path
- Calls `GET https://trading-api.kalshi.com/trade-api/v2/markets/{ticker}`
- Auth: `Authorization: Bearer {KALSHI_API_KEY}` header
- Outputs JSON to stdout:

```json
{
  "ticker": "TRUMPBUDGET-25MAR01",
  "title": "Will Trump sign the budget bill by March 1?",
  "description": "...",
  "resolution_criteria": "...",
  "yes_price": 0.34,
  "no_price": 0.66,
  "volume": 45200,
  "close_date": "2025-03-01T23:59:00Z",
  "status": "open"
}
```

### `news_fetcher.py`
- Accepts search query strings as CLI arguments
- Queries NewsAPI `/v2/everything` for each query (sorted by `publishedAt`)
- Fetches and parses RSS feeds via `feedparser`
- Deduplicates by URL
- Sorts all results by date descending
- Outputs JSON to stdout:

```json
[
  {
    "title": "Senate passes budget cloture 54-46",
    "source": "Reuters",
    "published": "2025-02-24T14:30:00Z",
    "snippet": "...",
    "url": "https://..."
  }
]
```

### RSS Feeds
| Source | Feed URL |
|--------|----------|
| Reuters Politics | `https://feeds.reuters.com/reuters/politicsNews` |
| AP Politics | `https://feeds.apnews.com/rss/politics` |
| Politico | `https://rss.politico.com/politics-news.xml` |
| The Hill | `https://thehill.com/feed` |
| Fox News Politics | `https://feeds.foxnews.com/foxnews/politics` |
| NPR Politics | `https://feeds.npr.org/1014/rss.xml` |

---

## Slash Command — `.claude/commands/analyze-market.md`

This file defines what happens when `/analyze-market <URL>` is invoked. It contains step-by-step orchestration instructions for Claude Code:

1. Extract the URL from the command argument
2. Run `kalshi_client.py` with the URL, parse the JSON output
3. Generate 3-5 targeted search queries from the market title and resolution criteria
4. Run `news_fetcher.py` with those queries, parse the JSON output
5. Spawn Evidence, Devil's Advocate, and Resolution agents in parallel (Task tool)
6. Pass all three outputs to the Calibrator agent (Task tool)
7. Display the final report in chat
8. Save the report to `results/YYYY-MM-DD_TICKER.md`

---

## Subagent Panel

All subagents are spawned via Claude Code's Task tool. Each receives the same base context: market data + news articles.

### Evidence Agent — `haiku`
**Mandate:** Establish the factual state of play.

Prompt focus:
- What has actually happened that is relevant to this market?
- What events are scheduled before the close date?
- What have key actors (Trump, Congress members, officials) said publicly?
- What do other prediction markets (Polymarket, Metaculus) show if mentioned in sources?

Output: Bullet-point factual summary, no interpretation.

---

### Devil's Advocate Agent — `sonnet`
**Mandate:** Argue against the obvious/consensus outcome.

Prompt focus:
- What is the market currently implying (yes_price)?
- What is the strongest case that the consensus is wrong?
- What historical precedents suggest this could fail?
- What wild cards or black swans are plausible before close?

Output: Numbered list of counterarguments, ranked by strength.

---

### Resolution Agent — `sonnet`
**Mandate:** Analyze the exact resolution criteria.

Prompt focus:
- What are the precise conditions for YES resolution?
- Are there ambiguities in the wording?
- Are there technical edge cases (partial fulfillment, timing, definitions)?
- Who resolves this market and do they have a track record of strict vs. loose interpretation?

Output: Resolution criteria breakdown with any flags or edge cases noted.

---

### Calibrator Agent — `opus`
**Mandate:** Synthesize all inputs into a final probability estimate.

Receives: market data + news + all three agent outputs.

Prompt focus:
- What probability (0–100) would a well-calibrated superforecaster assign to YES?
- What is the key crux — the single most important factor?
- Explicit bull case (reasons YES)
- Explicit bear case (reasons NO)
- Confidence level: low / medium / high

Output structure:
```
MARKET:     [title]
CLOSES:     [date] | VOLUME: $[volume]
─────────────────────────────────────────────────────
ESTIMATED PROBABILITY: X%
MARKET PRICE:          Y%
EDGE:                  +/- Z% → [lean YES / lean NO]
CONFIDENCE:            low / medium / high
CRUX:                  [single sentence]

BULL CASE:
- ...

BEAR CASE:
- ...

KEY SOURCES:
- [title] — [source] ([age])
```

---

## Results Persistence

Each completed analysis is saved to `results/YYYY-MM-DD_TICKER.md`.

File contains:
- Full Calibrator report
- Market data snapshot (price at time of analysis)
- News articles used (titles, sources, dates)
- Individual subagent outputs (Evidence, Devil's Advocate, Resolution)
- Timestamp of analysis

This allows reviewing past analyses, comparing estimated probability vs. how markets actually resolved, and identifying patterns in where the system has edge.

---

## Environment Variables (`.env`)

```
KALSHI_API_KEY=your_kalshi_readonly_key
NEWS_API_KEY=your_newsapi_key
```

---

## Dependencies (`requirements.txt`)

```
requests
feedparser
python-dotenv
```

---

## Constraints & Notes

- Kalshi API key is **read-only** — no order placement, data fetching only
- NewsAPI free tier: 100 requests/day — sufficient for manual single-market analysis
- RSS feeds are free and unlimited
- All AI calls run under Claude Pro subscription via Claude Code Task tool
- `.env` should be added to `.gitignore` if this project is ever version controlled
