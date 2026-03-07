# Kalshi Analyst — Web App Design

## Overview

Locally hosted web app for analyzing Kalshi prediction markets. Displays a curated watchlist of markets, lets you kick off the multi-agent research pipeline with one click, and shows real-time progress and structured results. Market titles link directly to the Kalshi market page for viewing rules and resolution criteria.

**Full TypeScript stack** — single Next.js app with API Route Handlers for the backend. The pipeline spawns Claude Code CLI subprocesses (using the user's Max subscription) rather than calling the Anthropic SDK directly.

## Architecture

```
+---------------------------------------------------+
|  Next.js App (React + API Routes)                 |
|  Frontend: Market Cards, Progress, Report View    |
|  Backend:  /api/markets, /api/analyze, SSE        |
+--------+------------------+-----------------------+
         |                  |
         v                  v
+------------------+  +-----------------------------+
| kalshi.ts        |  | pipeline.ts                 |
| RSA auth, fetch  |  | Spawns `claude` CLI agents  |
| market + event   |  | via child_process           |
| data             |  |                             |
+------------------+  | Evidence(haiku)             |
                      | DA(haiku)                   |
                      | [Resolution(sonnet) ||      |
                      |  Chaos(haiku)]              |
                      | Calibrator(sonnet)          |
                      |                             |
                      | Tools: WebSearch, Bash      |
                      | --output-format stream-json |
                      +-----------------------------+
                                |
                                v
                      +-----------------------------+
                      | results/                    |
                      | YYYY-MM-DD_HHMM_TICKER.md   |
                      | Persists across restarts    |
                      +-----------------------------+
```

## Tech Stack

| Layer    | Choice                   | Rationale                                      |
|----------|--------------------------|-------------------------------------------------|
| Frontend | Next.js 15 (React 19)    | Full-stack React, API routes, single project    |
| Backend  | Next.js Route Handlers   | No separate server; TS end-to-end               |
| Pipeline | Claude Code CLI (`claude`)| Spawned as subprocesses; uses Max subscription   |
| HTTP     | Built-in fetch           | Node 18+ native fetch, no extra deps            |
| Scraping | cheerio                  | HTML parsing for fetchers                        |
| Crypto   | Node crypto (built-in)   | RSA PKCS1v15 + SHA256 for Kalshi auth            |
| Progress | SSE                      | One-way server->client streaming                 |
| Storage  | Local filesystem         | Reports saved as markdown in results/            |

## Market Types

### Binary Markets
- Single YES/NO question (e.g., "Gov shutdown by March 15?")
- Display: YES price, NO price, volume, close date
- Report: single probability estimate, edge, bull/bear case

### Event Markets (Multi-Outcome)
- Multiple competing outcomes (e.g., "Who wins the Dem primary?")
- Kalshi JSON has `"type": "event"` with `markets` array
- Display: horizontal bar chart of all outcomes >= 5c, "+N more under 5c" collapsed
- Report: ranked outcome table with per-outcome estimate/edge, dark horse section

## Pipeline Architecture

The pipeline spawns Claude Code CLI agents as subprocesses using `--output-format stream-json` for real-time progress. Each agent runs with `--dangerously-skip-permissions` and `--no-session-persistence`.

5 stages (4 agents + 1 calibrator):

| Stage          | Model  | Depends On         | Parallel With | Tools              |
|----------------|--------|--------------------|---------------|--------------------|
| fetch          | --     | --                 | --            | Kalshi API         |
| evidence       | haiku  | fetch              | --            | WebSearch, Bash    |
| devil_advocate | haiku  | evidence           | --            | WebSearch, Bash    |
| resolution     | sonnet | devil_advocate     | chaos         | WebSearch          |
| chaos          | haiku  | devil_advocate     | resolution    | WebSearch          |
| calibrator     | sonnet | resolution + chaos | --            | (none)             |

Progress events from CLI stream-json output are parsed and forwarded to the frontend via SSE (tool use summaries like "Searching: ..." and "Running: ...").

## In-Memory State & HMR

The `activeRuns` map (tracking in-progress pipeline runs) is attached to `globalThis.__pipelineRuns` to survive Next.js hot module reloading in dev mode. Without this, the POST that starts a run and the GET that opens the SSE stream would see different module instances.

## API Endpoints

### `GET /api/markets`
Returns watchlist with current Kalshi prices, event info (seriesTicker, eventTitle for URL construction).

### `POST /api/markets`
Body: `{ "url": "https://kalshi.com/markets/..." }`
Parses ticker from URL, adds to watchlist.

### `DELETE /api/markets/[ticker]`
Removes from watchlist.

### `GET /api/markets/[ticker]/report`
Returns the latest saved report for a ticker from `results/`. Supports HEAD for existence checks.

### `POST /api/analyze`
Body: `{ "ticker": "KXFOO-BAR" }`
Kicks off pipeline. Returns `{ "runId": "..." }`.

### `GET /api/analyze/[runId]/sse`
SSE stream emitting `stage`, `progress`, and `complete` events.

### `GET /api/analyze/[runId]/report`
Returns report content from in-memory run (current session only).

### `POST /api/analyze/[runId]/cancel`
Cancels a running analysis.

## Kalshi URL Construction

Market titles link to the Kalshi website. URL format: `https://kalshi.com/markets/<series_ticker>/<event-title-slug>`

- `series_ticker` is fetched from the Kalshi events API (e.g., `KXELONMARS` for event `KXELONMARS-99`)
- The slug is derived by lowercasing the event title and replacing non-alphanumeric characters with hyphens
- Falls back to using the ticker itself if event info is unavailable

## Card States

1. **Idle** — Title (linked to Kalshi), prices, close date, volume. "Analyze" button. "View Report" if a past report exists on disk.
2. **Running** — Progress stepper with stage indicators, live status detail (tool use summaries), cancel button. Blue border.
3. **Complete** — Green border, "COMPLETE" badge. "View Report" (inline expandable), "Re-run" button.

## Report Viewing

Reports are available from two sources:
- **In-memory**: from the current pipeline run (`/api/analyze/[runId]/report`)
- **On disk**: from `results/` directory (`/api/markets/[ticker]/report`), persists across restarts

The frontend checks for existing reports on mount via HEAD request and shows "View Report" whenever one exists. Clicking fetches from in-memory first, falling back to disk.

## File Structure

```
webapp/
├── app/
│   ├── api/
│   │   ├── markets/
│   │   │   ├── route.ts                  GET (list) + POST (add)
│   │   │   └── [ticker]/
│   │   │       ├── route.ts              DELETE
│   │   │       └── report/route.ts       GET (latest saved report)
│   │   └── analyze/
│   │       ├── route.ts                  POST (start run)
│   │       └── [runId]/
│   │           ├── sse/route.ts          GET (SSE stream)
│   │           ├── report/route.ts       GET (in-memory report)
│   │           └── cancel/route.ts       POST (cancel)
│   ├── layout.tsx
│   ├── page.tsx                          Dashboard
│   └── globals.css
├── components/
│   ├── MarketCard.tsx                    Market display + report viewer
│   ├── ProgressStepper.tsx               Stage progress indicators
│   ├── AddMarketModal.tsx                URL input modal
│   └── OutcomeBar.tsx                    Event outcome probability bars
├── lib/
│   ├── kalshi.ts                         Kalshi API client (RSA auth + event info)
│   ├── pipeline.ts                       Pipeline orchestrator (CLI spawner)
│   ├── prompts.ts                        Prompt templates (binary + event variants)
│   ├── config.ts                         API endpoints & constants
│   ├── httpClient.ts                     Shared fetch wrapper
│   ├── textUtils.ts                      strip_html, matches_query
│   ├── watchlist.ts                      JSON file read/write
│   ├── types.ts                          Shared TypeScript types
│   └── useAnalysis.ts                    Client-side SSE hook
├── data/
│   └── watchlist.json                    Tracked market tickers
├── package.json
├── tsconfig.json
├── next.config.ts
└── postcss.config.mjs
```

## Key Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "cheerio": "^1.0",
    "dotenv": "^16"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^22",
    "@types/react": "^19",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `KALSHI_API_KEY` | Kalshi RSA public key ID |
| `KALSHI_PRIVATE_KEY_PATH` | Path to RSA private key .pem |
| `FEC_API_KEY` | FEC data (optional, uses DEMO_KEY) |
| `METACULUS_TOKEN` | Metaculus API auth |

## Open Questions

- **Concurrent analyses**: Currently one-at-a-time; analyze button stays available on other cards but only one `activeTicker` tracks progress.
- **Report rendering**: Currently displayed as raw markdown in a `<pre>` block. Could add markdown rendering.
- **Caching**: Cache Kalshi price fetches for ~60s to avoid hammering API on page load.
- **Report history**: Show multiple past reports per market, not just the latest.
