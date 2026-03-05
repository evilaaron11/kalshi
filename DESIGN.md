# Kalshi Prediction Assistant — Design Document

## Overview

A research assistant that helps evaluate Kalshi prediction markets. The user identifies a market; the system fetches live market data, then runs a sequential-then-parallel panel of Claude subagents that research from scratch and accumulate a shared knowledge pool, producing a structured probability estimate with a betting recommendation.

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
└── DESIGN.md                    # This file
```

---

## Invocation

From within this project directory in Claude Code:

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
  → output: title, resolution criteria,
            yes_price, close_date, volume
            │
            ▼
  ┌─────────────────────────────────────────┐
  │  Phase 1 — Sequential Research         │
  │                                         │
  │  [Evidence Agent]    model: haiku       │
  │  → up to 7 searches, builds pool       │
  │            │                            │
  │            ▼                            │
  │  [Devil's Advocate]  model: haiku       │
  │  → gets Evidence output + sources pool  │
  │  → up to 5 searches for gaps, extends   │
  └─────────────────────────────────────────┘
            │
            ▼
  ┌─────────────────────────────────────────┐
  │  Phase 2 — Sequential Analysis          │
  │                                         │
  │  [Resolution Agent]  model: sonnet      │
  │            │                            │
  │            ▼                            │
  │  [Chaos Agent]       model: haiku       │
  │  → both receive full research from      │
  │    Evidence + Devil's Advocate          │
  └─────────────────────────────────────────┘
            │
            ▼
  [Calibrator Agent]    model: sonnet
  → synthesizes all four agent outputs
  → produces final report
            │
            ▼
  Report displayed in Claude Code chat
  Report saved to results/YYYY-MM-DD_TICKER.md
```

---

## Python Scripts

### `kalshi_client.py`
- Accepts a Kalshi market URL or ticker as a CLI argument
- Parses the ticker from the URL path
- Calls `GET https://api.elections.kalshi.com/trade-api/v2/markets/{ticker}`
- Auth: RSA-signed request headers (`KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-SIGNATURE`)
- For event tickers (404 on market endpoint), falls back to listing all markets under that event
- Outputs JSON to stdout:

```json
{
  "ticker": "TRUMPBUDGET-25MAR01",
  "title": "Will Trump sign the budget bill by March 1?",
  "resolution_criteria": "...",
  "yes_price": 0.34,
  "no_price": 0.66,
  "volume": 45200,
  "close_date": "2025-03-01T23:59:00Z",
  "status": "open"
}
```

For events, outputs `"type": "event"` with a `markets` array of qualifying outcomes (yes_price ≥ 5%) and optionally a `sub_threshold_markets` array.

---

## Slash Command — `.claude/commands/analyze-market.md`

Full orchestration instructions for Claude Code. The pipeline:

1. Fetch market data via `kalshi_client.py`
2. Run **Evidence Agent** — up to 7 searches, outputs factual summary + `## SOURCES POOL`
3. Run **Devil's Advocate** — up to 5 searches for gaps, outputs counterarguments + `## ADDITIONAL SOURCES`
4. Merge sources pool from both agents
5. Run **Resolution Agent** — receives Evidence + DA research, max 1 search
6. Run **Chaos Agent** — receives Evidence + DA research, max 1 search
7. Run **Calibrator** — synthesizes all four outputs, no additional search
8. Display report, save to `results/YYYY-MM-DD_TICKER.md`

---

## Subagent Panel

All subagents are spawned via Claude Code's Task tool. Phase 1 runs sequentially so research accumulates into a shared pool. Phase 2 also runs sequentially in the foreground — Resolution then Chaos — since each takes under a minute and foreground execution is more reliable than background task polling.

### Search Policies

| Agent | Search | Rationale |
|-------|--------|-----------|
| Evidence Agent | Max 7 | Factual backbone — use all if warranted, breadth first |
| Devil's Advocate | Max 5 | Contrarian gaps only — don't re-research the pool |
| Resolution Agent | Max 1 | May need to verify a specific resolution ambiguity |
| Chaos Agent | Max 1 | Tail risks are hypothetical; deep research is wasteful |
| Calibrator | None | Synthesizes from agent outputs only |

### Evidence Agent — `haiku`
**Mandate:** Establish the factual state of play via active research.
- Uses WebSearch as primary tool
- Outputs bullet-point factual summary (no interpretation)
- Ends response with `## SOURCES POOL` — list of every source consulted

### Devil's Advocate — `haiku`
**Mandate:** Argue against the consensus outcome using research the Evidence Agent missed.
- Receives Evidence Agent's full output + sources pool
- Focuses searches on counterevidence, historical precedents, contrarian data
- Outputs numbered counterarguments ranked by strength
- Ends response with `## ADDITIONAL SOURCES`

### Resolution Agent — `sonnet`
**Mandate:** Analyze the exact resolution criteria for gotchas and edge cases.
- Receives both Phase 1 outputs
- Focuses on precise YES/NO conditions, ambiguities, timing technicalities

### Chaos Agent — `haiku`
**Mandate:** Generate specific, creative tail risk scenarios (1–8% probability each).
- Receives both Phase 1 outputs
- Focuses on scenarios not currently priced or discussed

### Calibrator — `sonnet`
**Mandate:** Synthesize all research into a final probability estimate and betting recommendation.
- Receives all four agent outputs
- Produces structured report with edge, bull/bear case, tail risks, Kelly-sized bet sizing, and explicit probability methodology

---

## Results Persistence

Each completed analysis is saved to `results/YYYY-MM-DD_TICKER.md` containing:
- Full Calibrator report
- Market data snapshot (price at time of analysis)
- All subagent outputs (Evidence, Devil's Advocate, Resolution, Chaos)
- Accumulated sources pool
- Timestamp

This allows reviewing past analyses, comparing estimated probability vs. actual resolution, and identifying where the system has edge.

---

## Environment Variables (`.env`)

```
KALSHI_API_KEY=your_kalshi_readonly_key
KALSHI_PRIVATE_KEY_PATH=./kalshi_private.pem
```

---

## Dependencies (`requirements.txt`)

```
requests
cryptography
python-dotenv
```

---

## Constraints & Notes

- Kalshi API key is **read-only** — no order placement, data fetching only
- All AI calls and WebSearch run under Claude Pro subscription via Claude Code
- `.env` and `*.pem` should be in `.gitignore`
