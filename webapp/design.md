# Kalshi Analyst — Web App Design

## Overview

Locally hosted web app for analyzing Kalshi prediction markets. Displays a curated list of political/policy markets, lets you kick off the multi-agent research pipeline with one click, and shows real-time progress and structured results.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js Frontend (React)                       │
│  Market Cards · Progress Tracker · Report View  │
└───────┬─────────────────────▲───────────────────┘
        │ REST (POST/GET)     │ SSE (progress events)
┌───────▼─────────────────────┼───────────────────┐
│  Python Backend (FastAPI)                       │
│  /api/markets      — fetch curated market data  │
│  /api/analyze      — kick off pipeline          │
│  /api/analyze/sse  — stream progress events     │
│  /api/reports      — retrieve saved reports     │
└───────┬─────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────┐
│  Claude Agent SDK Pipeline                      │
│  Evidence(haiku) → DA(haiku) →                  │
│    [Resolution(sonnet) ‖ Chaos(haiku)]          │
│      → Calibrator(sonnet)                       │
│                                                 │
│  Tools: web search, fetchers/*, kalshi_client   │
│  Emits SSE events per stage transition          │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Layer    | Choice              | Rationale                                                        |
|----------|---------------------|------------------------------------------------------------------|
| Frontend | Next.js (React)     | Full-stack React, API routes, good DX                            |
| Backend  | FastAPI (Python)    | Reuses existing `kalshi_client.py` and `fetchers/` directly      |
| Pipeline | Claude Agent SDK    | Purpose-built for multi-agent orchestration with tool use        |
| Progress | SSE                 | One-way server→client streaming; simpler than WebSockets         |
| Storage  | Local filesystem    | Reports saved as markdown in `results/`, same as current setup   |

## Market Types

The app handles two market types, auto-detected from Kalshi API response:

### Binary Markets
- Single YES/NO question (e.g., "Gov shutdown by March 15?")
- Display: YES price, NO price, volume, close date
- Report: single probability estimate, edge, bull/bear case

### Event Markets (Multi-Outcome)
- Multiple competing outcomes (e.g., "Who wins the Dem primary?")
- Kalshi JSON has `"type": "event"` with `markets` array
- Display: horizontal bar chart of all outcomes ≥5¢, "+N more under 5¢" collapsed
- Report: ranked outcome table with per-outcome estimate/edge, dark horse section

## Key Features

### Curated Market List
- Simple JSON config file listing market/event URLs you want to track
- Backend fetches current prices from Kalshi API on page load
- `[+ Add]` button to paste a new Kalshi URL

### One-Click Analysis
- `[Analyze ▶]` button triggers the full pipeline
- Pipeline runs the same 5-agent flow as the CLI skill
- `[Cancel]` button to abort a running analysis
- `[Re-run ▶]` on completed reports to refresh with latest data

### Real-Time Progress
- Horizontal step indicator: Fetch → Evidence → DA → [Resolution ‖ Chaos] → Calibrator
- Live status line from current agent (e.g., "DA running search 2/5")
- Stage timing displayed

### Structured Results
- Hero section: estimate vs market price, edge, confidence
- Crux one-liner
- Bull/bear case side-by-side (binary) or ranked outcome table (event)
- Tail risks, resolution watch, betting recommendation, methodology
- Collapsible raw agent outputs for full transparency
- Accumulated sources list

## Card States

Each market card has three states:

1. **Idle** — Title, prices, close date, volume. "Analyze" button.
2. **Running** — Highlighted with progress stepper, live status, timer, cancel button.
3. **Complete** — Summary strip (estimate, edge, confidence), crux, bet recommendation preview. "View Full Report" and "Re-run" buttons.

## API Endpoints

### `GET /api/markets`
Returns curated market list with current Kalshi prices.

### `POST /api/analyze`
Body: `{ "url": "https://kalshi.com/markets/..." }`
Kicks off pipeline. Returns `{ "run_id": "..." }`.

### `GET /api/analyze/{run_id}/sse`
SSE stream emitting events:
```
event: stage
data: {"stage": "evidence", "status": "running"}

event: progress
data: {"stage": "evidence", "detail": "Web search 3/7..."}

event: stage
data: {"stage": "evidence", "status": "complete", "duration_s": 48}

event: stage
data: {"stage": "resolution", "status": "running"}
event: stage
data: {"stage": "chaos", "status": "running"}

event: complete
data: {"run_id": "...", "report_path": "results/2026-03-05_SHUTDOWN.md"}
```

### `GET /api/reports/{run_id}`
Returns parsed report JSON for frontend rendering.

## Pipeline Stages (SSE event names)

| Stage        | Model  | Depends On         | Parallel With |
|--------------|--------|--------------------|---------------|
| fetch        | —      | —                  | —             |
| evidence     | haiku  | fetch              | —             |
| devil_advocate | haiku | evidence          | —             |
| resolution   | sonnet | devil_advocate     | chaos         |
| chaos        | haiku  | devil_advocate     | resolution    |
| calibrator   | sonnet | resolution + chaos | —             |

## File Structure (planned)

```
futureWebApp/
├── design.md          ← this file
├── mockups.md         ← ASCII mockups of all views
├── backend/
│   ├── main.py        ← FastAPI app
│   ├── pipeline.py    ← Agent SDK orchestration
│   ├── models.py      ← Pydantic schemas
│   └── config.py      ← curated markets list
├── frontend/
│   ├── app/
│   │   ├── page.tsx           ← market list dashboard
│   │   └── report/[id]/page.tsx  ← full report view
│   ├── components/
│   │   ├── MarketCard.tsx
│   │   ├── ProgressStepper.tsx
│   │   ├── BinaryReport.tsx
│   │   ├── EventReport.tsx
│   │   └── OutcomeBar.tsx
│   └── lib/
│       └── useAnalysis.ts     ← SSE hook
```

## Open Questions

- **Auth**: Kalshi API keys are in `.env` — backend reads them directly. No user auth needed (local only).
- **Concurrent analyses**: Allow multiple pipelines running at once, or queue? Start with one-at-a-time, queue button grays out.
- **History**: Show past reports per market? Could add a small "history" dropdown on completed cards.
- **Caching**: Cache Kalshi price fetches for ~60s to avoid hammering API on page refreshes.
