# Kalshi Market Analyst

A multi-agent pipeline for analyzing [Kalshi](https://kalshi.com) prediction markets. Fetches live market data, runs a sequential-then-parallel panel of Claude subagents that research from scratch and share a cumulative knowledge pool, then synthesizes a calibrated probability estimate with a betting recommendation.

## How it works

```
/analyze-market <url>
      │
      └── kalshi_client.py   →  fetch live market data + prices
            │
            ▼
      Phase 1 — Sequential Research
      │
      ├── Evidence Agent (haiku)       max 7 searches, builds sources pool
      │         │                      + whitehouse_fetch.py / oira_agenda.py
      │         ▼
      └── Devil's Advocate (haiku)     max 5 searches, extends sources pool
            │                          + whitehouse_fetch.py / oira_agenda.py
            ▼
      Phase 2 — Sequential Analysis
      │
      ├── Resolution Agent (sonnet)    criteria & edge cases (max 1 search)
      │         │
      │         ▼
      └── Chaos Agent (haiku)          tail risks 1–8% (max 1 search)
            │
            ▼
      Calibrator (sonnet)  →  final report + edge + bet sizing
```

Supports both **single binary markets** and **multi-outcome events** (e.g. "Who will be Fed Chair?", "When will X happen?").

## Research Tools

Research agents have access to specialized primary-source fetchers alongside web search. These do not count against the agents' search limits.

| Script | What it fetches | When agents use it |
|---|---|---|
| `whitehouse_fetch.py` | Full text of executive orders, proclamations, press briefings, and statements from whitehouse.gov | Presidential actions, EOs, tariffs, nominations, pardons — any "will Trump do/sign X" market |
| `oira_agenda.py` | Federal Register published rules + OIRA Unified Agenda (forward-looking pipeline) | Agency rulemaking, regulatory deadlines, "will X rule be finalized" markets |
| `fec_fetch.py` | FEC campaign finance: cash on hand, total raised/spent, burn rate | Election markets — fundraising as a leading predictor |
| `polling_fetch.py` | Polling averages from Wikipedia and RealClearPolitics | Electoral race markets |

## Setup

**Requirements:** Python 3.10+, a Kalshi API key, [Claude Code](https://claude.ai/code) (Claude Pro).

```bash
pip install requests feedparser python-dotenv cryptography beautifulsoup4
```

Create a `.env` file:

```
KALSHI_API_KEY=your_api_key_here
KALSHI_PRIVATE_KEY_PATH=./kalshi_private.pem
```

Place your Kalshi RSA private key at the path specified above.

## Usage

Run from Claude Code inside this project directory:

```
/analyze-market https://kalshi.com/markets/SOMEEVENT-TICKER
```

Or with just the ticker:

```
/analyze-market SOMEEVENT-TICKER
```

You can also run the fetchers directly:

```bash
# Market data
python kalshi_client.py https://kalshi.com/markets/SOMEEVENT-TICKER

# White House primary sources
python whitehouse_fetch.py --search "tariffs" --type eos --limit 5
python whitehouse_fetch.py --search "Ukraine ceasefire" --type briefings

# Federal regulatory pipeline
python oira_agenda.py --search "DOGE federal workforce" --agency OPM
python oira_agenda.py --search "EPA climate" --source fedreg --limit 10

# FEC campaign finance
python fec_fetch.py --candidate "Jon Ossoff" --office S --state GA --cycle 2026
python fec_fetch.py --committee "Save America" --limit 5

# Polling averages
python polling_fetch.py --race "Georgia Senate 2026"
python polling_fetch.py --source rcp
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

## Web App (in progress)

A locally hosted web UI for the analysis pipeline. Lives on the `webapp` branch under `webapp/`.

**Stack:** Next.js (React/TypeScript/Tailwind) frontend + FastAPI (Python) backend, connected via SSE for real-time pipeline progress.

### Running locally

```bash
# Backend (from repo root)
python -m uvicorn webapp.backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd webapp/frontend; npm run dev
```

Frontend at `http://localhost:3000`, backend at `http://localhost:8000`.

### What's built

- Dashboard with curated market watchlist (add/remove via URL)
- Market cards for both binary and multi-outcome event markets
- Horizontal outcome bars with auto-shortened labels for events
- Real-time pipeline progress stepper with SSE streaming
- Add Market modal
- Full API: `GET /api/markets`, `POST /api/markets`, `POST /api/analyze`, `GET /api/analyze/{id}/sse`, cancel endpoint

### TODO

- [ ] Integrate Claude Agent SDK into pipeline stages (currently stubbed with placeholders)
- [ ] Full report view page (`app/report/[id]/page.tsx`) with structured sections (bull/bear, tail risks, methodology, etc.)
- [ ] Report parsing endpoint — return structured JSON from saved markdown
- [ ] History dropdown on completed cards (past reports per market)
- [ ] Price caching (~60s) to avoid hammering Kalshi API on refresh
- [ ] Concurrent analysis queue (currently one-at-a-time)

### File structure

```
webapp/
├── design.md              # architecture & design decisions
├── mockups.md             # ASCII mockups of all views
├── backend/
│   ├── main.py            # FastAPI app + endpoints
│   ├── pipeline.py        # agent orchestration + SSE events
│   ├── models.py          # Pydantic schemas
│   ├── config.py          # watchlist persistence
│   └── requirements.txt
└── frontend/
    ├── app/
    │   └── page.tsx        # dashboard
    ├── components/
    │   ├── MarketCard.tsx
    │   ├── ProgressStepper.tsx
    │   ├── OutcomeBar.tsx
    │   └── AddMarketModal.tsx
    └── lib/
        ├── api.ts          # API client
        ├── useAnalysis.ts  # SSE hook
        └── types.ts        # TypeScript types
```

## API keys

| Key | Required | Source |
|---|---|---|
| `KALSHI_API_KEY` + RSA private key | Yes | [Kalshi API settings](https://kalshi.com/profile/api) |
| `FEC_API_KEY` | Optional | [api.open.fec.gov](https://api.open.fec.gov) — higher rate limits for `fec_fetch.py`; uses `DEMO_KEY` (1000 req/hour) without it |
