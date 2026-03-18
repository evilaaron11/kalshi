# Kalshi Market Analyst

A multi-agent pipeline for analyzing [Kalshi](https://kalshi.com) prediction markets. Runs a panel of Claude subagents that research from scratch and share a cumulative knowledge pool, then synthesizes a calibrated probability estimate with a betting recommendation.

Available as both a **web app** (Next.js dashboard with real-time SSE progress) and a **CLI skill** (`/analyze-market`).

## Architecture

```
webapp/                          Unified Next.js 15 app (TypeScript)
├── app/                         Pages & API routes
│   ├── page.tsx                 Dashboard — watchlist with live prices
│   └── api/
│       ├── markets/             CRUD for watchlist + live Kalshi prices
│       └── analyze/             Pipeline orchestration + SSE streaming
├── components/                  React UI (MarketCard, ProgressStepper, etc.)
├── lib/
│   ├── kalshi.ts                Kalshi API client (RSA-signed auth)
│   ├── pipeline.ts              Multi-agent orchestration (spawns Claude CLI)
│   ├── prompts.ts               All agent prompt templates
│   ├── fetchers/                Primary-source data fetchers
│   │   ├── cli.ts               CLI entry point (agents call via Bash)
│   │   ├── crossMarket.ts       Polymarket + Metaculus price comparison
│   │   ├── fec.ts               FEC campaign finance data
│   │   ├── oira.ts              Federal Register + OIRA regulatory pipeline
│   │   ├── polling.ts           Wikipedia + RCP polling averages
│   │   └── whitehouse.ts        White House executive actions & briefings
│   ├── config.ts                API endpoints, timeouts, constants
│   ├── httpClient.ts            Shared fetch wrapper
│   ├── textUtils.ts             HTML stripping, fuzzy matching
│   ├── types.ts                 TypeScript type definitions
│   ├── useAnalysis.ts           React hook for SSE pipeline progress
│   └── watchlist.ts             Watchlist persistence (JSON file)
├── __tests__/                   Vitest test suite
├── data/watchlist.json          Saved watchlist tickers
└── results/                     Saved analysis reports (markdown)
```

## Pipeline

```
/analyze-market <url>
      │
      └── kalshi.ts   →  fetch live market data + prices
            │
            ▼
      Phase 1 — Sequential Research
      │
      ├── Evidence Agent (haiku)       max 7 web searches + fetcher tools
      │         │
      │         ▼
      └── Devil's Advocate (haiku)     max 5 searches, extends sources pool
            │
            ▼
      Phase 2 — Parallel Analysis
      │
      ├── Resolution Agent (sonnet)    criteria & edge cases (max 1 search)
      │
      └── Chaos Agent (haiku)          tail risks 1–8% (max 1 search)
            │
            ▼
      Calibrator (sonnet)  →  final report + edge + bet sizing
```

Supports both **single binary markets** and **multi-outcome events**.

## Research Tools

Agents have access to specialized fetchers alongside web search. These don't count against search limits.

| Fetcher | Data Source | Use Case |
|---|---|---|
| `whitehouse` | Executive orders, briefings, statements from whitehouse.gov | Presidential actions, EOs, tariffs, nominations |
| `oira` | Federal Register + OIRA Unified Agenda | Agency rulemaking, regulatory deadlines |
| `fec` | FEC campaign finance (cash on hand, raised/spent, burn rate) | Election markets |
| `polling` | Wikipedia + RealClearPolitics polling averages | Electoral race markets |
| `cross-market` | Polymarket + Metaculus prices | Cross-platform arbitrage detection |

Run fetchers directly:

```bash
cd webapp
npx tsx lib/fetchers/cli.ts cross-market --query "government shutdown"
npx tsx lib/fetchers/cli.ts whitehouse --search "tariffs" --type eos --limit 5
npx tsx lib/fetchers/cli.ts oira --search "EPA climate" --source fedreg
npx tsx lib/fetchers/cli.ts fec --candidate "Jon Ossoff" --office S --state GA
npx tsx lib/fetchers/cli.ts polling --race "Georgia Senate 2026"
```

## Setup

**Requirements:** Node.js 20+, [Claude Code](https://claude.ai/code) (Claude Pro/Max).

```bash
cd webapp
npm install
```

Create `webapp/.env.local`:

```
KALSHI_API_KEY=your_api_key
KALSHI_PRIVATE_KEY_PATH=../kalshi_private.pem
```

Place your Kalshi RSA private key at the path specified above.

## Usage

### Web App

```bash
cd webapp
npm run dev
```

Open `http://localhost:3000`. Add markets to the watchlist, view live prices, and run the full analysis pipeline with real-time progress.

### CLI

From Claude Code inside the project directory:

```
/analyze-market https://kalshi.com/markets/SOMEEVENT-TICKER
```

### Tests

```bash
cd webapp
npm test
```

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/markets` | Watchlist with live Kalshi prices |
| `POST` | `/api/markets` | Add ticker to watchlist |
| `DELETE` | `/api/markets/[ticker]` | Remove ticker |
| `GET` | `/api/markets/[ticker]/report` | Latest saved report |
| `POST` | `/api/analyze` | Start pipeline run, returns `runId` |
| `GET` | `/api/analyze/[runId]/sse` | SSE stream of pipeline events |
| `GET` | `/api/analyze/[runId]/report` | Completed report markdown |
| `POST` | `/api/analyze/[runId]/cancel` | Cancel running analysis |

## API Keys

| Key | Required | Source |
|---|---|---|
| `KALSHI_API_KEY` + RSA private key | Yes | [Kalshi API settings](https://kalshi.com/profile/api) |
| `FEC_API_KEY` | Optional | [api.open.fec.gov](https://api.open.fec.gov) — uses `DEMO_KEY` without it |
| `METACULUS_TOKEN` | Optional | Enables Metaculus cross-market comparison |

## Output

The Calibrator produces a structured report including:

- Estimated probability vs. market price (edge)
- Bull case / Bear case
- Tail risks worth monitoring
- Resolution watch (technical flags)
- Betting recommendation with Half-Kelly sizing
- Cross-market price comparison
- Full probability methodology

Reports are saved to `results/YYYY-MM-DD_HHMM_{TICKER}.md`.
