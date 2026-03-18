# Kalshi Market Analyst

A multi-agent pipeline for analyzing [Kalshi](https://kalshi.com) prediction markets. Runs a panel of Claude subagents that research from scratch and share a cumulative knowledge pool, then synthesizes a calibrated probability estimate with a betting recommendation.

Available as both a **web app** (Next.js dashboard with real-time SSE progress) and a **CLI skill** (`/analyze-market`).

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          «system» Kalshi Analyst                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    «subsystem» Next.js App                       │  │
│  │                                                                  │  │
│  │  ┌─────────────────┐      ┌─────────────────────────────────┐   │  │
│  │  │  «component»    │      │      «component» API Routes     │   │  │
│  │  │  React Frontend │      │                                 │   │  │
│  │  │                 │ HTTP │  /api/markets    GET|POST|DELETE │   │  │
│  │  │  Dashboard      │─────│  /api/analyze     POST           │   │  │
│  │  │  MarketCard     │      │  /api/analyze/:id/sse    GET    │   │  │
│  │  │  ReportViewer   │ SSE  │  /api/analyze/:id/report GET    │   │  │
│  │  │  ProgressStepper│◄─────│  /api/analyze/:id/cancel POST   │   │  │
│  │  └─────────────────┘      └──────────┬──────────────────────┘   │  │
│  │          │                           │                          │  │
│  │          │ useAnalysis()             │ pipeline.ts               │  │
│  │          │ (EventSource)             │ (orchestration)           │  │
│  │          ▼                           ▼                          │  │
│  │  ┌─────────────────┐      ┌─────────────────────────────────┐   │  │
│  │  │  «component»    │      │      «component» Lib Core       │   │  │
│  │  │  Report Parser  │      │                                 │   │  │
│  │  │                 │      │  kalshi.ts ─── RSA auth ──────┐ │   │  │
│  │  │  reportParser.ts│      │  pipeline.ts ── spawn ──────┐ │ │   │  │
│  │  │  richTextUtils  │      │  prompts.ts                 │ │ │   │  │
│  │  │  RichText.tsx   │      │  watchlist.ts               │ │ │   │  │
│  │  └─────────────────┘      └─────────────────────────┬───┘ │ │   │  │
│  │                                                     │     │ │   │  │
│  │  ┌──────────────────────────────────────────────────┐│     │ │   │  │
│  │  │            «component» Fetcher CLI               ││     │ │   │  │
│  │  │                                                  ││     │ │   │  │
│  │  │  cli.ts ─── crossMarket.ts ── polling.ts         ││     │ │   │  │
│  │  │         ├── fec.ts         ── whitehouse.ts      ││     │ │   │  │
│  │  │         └── oira.ts                              ││     │ │   │  │
│  │  └──────────────────────────────────────────────────┘│     │ │   │  │
│  └──────────────────────────────────────────────────────┘     │ │   │  │
│                                                               │ │   │  │
│  ┌────────────────────────────────────────────────────────────┘ │   │  │
│  │                                                              │   │  │
│  ▼                                                              ▼   │  │
│  ┌─────────────────────────────┐   ┌───────────────────────────┐   │  │
│  │  «external» Claude CLI     │   │  «external» Kalshi API    │   │  │
│  │                             │   │                           │   │  │
│  │  claude -p --model <model>  │   │  api.elections.kalshi.com │   │  │
│  │  --output-format stream-json│   │  /trade-api/v2            │   │  │
│  │                             │   │  RSA-signed (PKCS1v15)    │   │  │
│  │  ┌───────────────────────┐  │   └───────────────────────────┘   │  │
│  │  │ «agent» Evidence      │  │                                   │  │
│  │  │ haiku · 7 searches    │  │   ┌───────────────────────────┐   │  │
│  │  ├───────────────────────┤  │   │  «external» Data Sources  │   │  │
│  │  │ «agent» Devil's Advoc.│  │   │                           │   │  │
│  │  │ haiku · 5 searches    │  │   │  Polymarket (gamma API)   │   │  │
│  │  ├───────────────────────┤  │   │  Metaculus  (REST API)    │   │  │
│  │  │ «agent» Resolution    │  │   │  FEC        (open.fec.gov)│   │  │
│  │  │ sonnet · 1 search     │──┼──▶│  Fed Register (JSON API) │   │  │
│  │  ├───────────────────────┤  │   │  OIRA       (XML feed)   │   │  │
│  │  │ «agent» Chaos         │  │   │  White House (RSS feeds)  │   │  │
│  │  │ haiku · 1 search      │  │   │  Wikipedia  (MediaWiki)   │   │  │
│  │  ├───────────────────────┤  │   │  RCP        (HTML scrape) │   │  │
│  │  │ «agent» Calibrator    │  │   └───────────────────────────┘   │  │
│  │  │ sonnet · no search    │  │                                   │  │
│  │  └───────────────────────┘  │                                   │  │
│  └─────────────────────────────┘                                   │  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     «storage» File System                        │  │
│  │  data/watchlist.json          results/YYYY-MM-DD_HHMM_TICKER.md │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Sequence

```
 ┌────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌───────┐  ┌────────────┐
 │ Client │  │ API Route│  │ pipeline.ts│  │ Claude CLI │  │Fetchers│  │External API│
 └───┬────┘  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  └───┬───┘  └─────┬──────┘
     │            │              │               │             │            │
     │ POST /analyze             │               │             │            │
     │───────────>│ startRun()   │               │             │            │
     │            │─────────────>│               │             │            │
     │ GET /sse   │              │               │             │            │
     │───────────>│ subscribe()  │               │             │            │
     │◄╌╌╌╌╌╌╌╌╌╌│╌╌╌ SSE ╌╌╌╌╌│               │             │            │
     │            │              │               │             │            │
     │            │  ╔═══════════╧═══════╗       │             │            │
     │            │  ║ Phase 0: Fetch    ║       │             │            │
     │            │  ╚═══════════╤═══════╝       │             │            │
     │            │              │ fetchMarket() │             │            │
     │            │              │───────────────┼─────────────┼───────────>│ Kalshi API
     │            │              │◄──────────────┼─────────────┼────────────│
     │◄╌╌ stage: fetch complete ╌│               │             │            │
     │            │              │               │             │            │
     │            │  ╔═══════════╧═══════════════╗             │            │
     │            │  ║ Phase 1: Sequential       ║             │            │
     │            │  ╚═══════════╤═══════════════╝             │            │
     │            │              │ spawn(claude)  │             │            │
     │            │              │───────────────>│ Evidence    │            │
     │            │              │                │  WebSearch ─┼───────────>│
     │            │              │                │  Bash(cli)──┼──>│        │
     │◄╌╌ progress: Searching╌╌╌│◄╌╌stream-json╌╌│            │  run()     │
     │◄╌╌ progress: Fetcher ╌╌╌╌│◄╌╌╌╌╌╌╌╌╌╌╌╌╌╌│            │◄──│        │
     │            │              │◄───────────────│ result     │            │
     │◄╌╌ stage: evidence done ╌╌│               │             │            │
     │            │              │                │             │            │
     │            │              │ spawn(claude)  │             │            │
     │            │              │───────────────>│ Devil's Adv │            │
     │◄╌╌ progress events ╌╌╌╌╌╌│◄╌╌stream-json╌╌│            │            │
     │            │              │◄───────────────│ result     │            │
     │◄╌╌ stage: DA done ╌╌╌╌╌╌╌│               │             │            │
     │            │              │               │             │            │
     │            │  ╔═══════════╧═══════════════╗             │            │
     │            │  ║ Phase 2: Parallel         ║             │            │
     │            │  ╚═══════════╤═══════════════╝             │            │
     │            │              │──┬─ spawn ───>│ Resolution  │            │
     │            │              │  └─ spawn ───>│ Chaos       │            │
     │◄╌╌ progress (interleaved)╌│◄╌╌╌╌╌╌╌╌╌╌╌╌╌│             │            │
     │            │              │◄──────────────│ both done   │            │
     │◄╌╌ stages: res+chaos done│               │             │            │
     │            │              │               │             │            │
     │            │  ╔═══════════╧═══════════════╗             │            │
     │            │  ║ Phase 3: Synthesis        ║             │            │
     │            │  ╚═══════════╤═══════════════╝             │            │
     │            │              │ spawn(claude)  │             │            │
     │            │              │───────────────>│ Calibrator  │            │
     │            │              │◄───────────────│ final report│            │
     │◄╌╌ stage: calibrator done│               │             │            │
     │            │              │               │             │            │
     │            │              │ saveReport()  │             │            │
     │            │              │──────────────>│ results/*.md │            │
     │◄╌╌ event: complete ╌╌╌╌╌╌│               │             │            │
     │            │              │               │             │            │
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      «page» Dashboard                       │
│                        app/page.tsx                          │
├───────────┬───────────────────────────────────┬─────────────┤
│           │                                   │             │
│           ▼                                   ▼             │
│  ┌─────────────────┐                ┌──────────────────┐    │
│  │  AddMarketModal  │                │   useAnalysis()  │    │
│  │                 │                │  (SSE hook)      │    │
│  └─────────────────┘                └────────┬─────────┘    │
│                                              │              │
│           ┌──────────────────────────────────┘              │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 «component» MarketCard                │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  market: MarketSummary                               │   │
│  │  runState: RunState                                  │   │
│  ├──────────┬───────────────────┬───────────────────────┤   │
│  │          │                   │                       │   │
│  │          ▼                   ▼                       │   │
│  │  ┌──────────────┐   ┌───────────────────────────┐    │   │
│  │  │ OutcomeBar   │   │    ProgressStepper        │    │   │
│  │  │ (events)     │   │                           │    │   │
│  │  └──────────────┘   │  ┌─────────────────────┐  │    │   │
│  │                     │  │    StageDetail       │  │    │   │
│  │                     │  │  (tool activity feed)│  │    │   │
│  │                     │  └─────────────────────┘  │    │   │
│  │                     └───────────────────────────┘    │   │
│  │                              │                       │   │
│  │                              ▼                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │            «component» ReportViewer            │   │   │
│  │  ├───────────────────────────────────────────────┤   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │   │
│  │  │  │ Verdict  │ │Bull/Bear │ │  Betting Rec  │  │   │   │
│  │  │  │ Header   │ │ Columns  │ │  Card         │  │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘  │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │   │
│  │  │  │Tail Risks│ │Resolution│ │ Cross-Market  │  │   │   │
│  │  │  │  (icons) │ │  Watch   │ │ Table/Text    │  │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘  │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │   │
│  │  │  │  Sources │ │Methodol. │ │ Agent Outputs │  │   │   │
│  │  │  │ (links)  │ │(collapse)│ │  (collapsed)  │  │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘  │   │   │
│  │  │                                               │   │   │
│  │  │  Uses: RichText, ReportSection, RichBullet    │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
webapp/
├── app/                         Pages & API routes
│   ├── page.tsx                 Dashboard
│   └── api/
│       ├── markets/             CRUD + live Kalshi prices
│       └── analyze/             Pipeline orchestration + SSE
├── components/                  React UI
│   ├── MarketCard.tsx           Market display + analysis trigger
│   ├── ReportViewer.tsx         Structured report rendering
│   ├── ProgressStepper.tsx      Pipeline stage indicators
│   ├── StageDetail.tsx          Per-stage tool activity feed
│   ├── ReportSection.tsx        Collapsible section wrapper
│   ├── RichText.tsx             Inline markdown renderer
│   ├── OutcomeBar.tsx           Event outcome probability bar
│   └── AddMarketModal.tsx       URL input modal
├── lib/
│   ├── kalshi.ts                Kalshi API client (RSA auth)
│   ├── pipeline.ts              Agent orchestration (Claude CLI)
│   ├── prompts.ts               Agent prompt templates
│   ├── reportParser.ts          Report text → structured data
│   ├── richTextUtils.ts         Markdown tokenizer + bullet parser
│   ├── fetchers/                Primary-source data fetchers
│   │   ├── cli.ts               CLI entry point for agents
│   │   ├── crossMarket.ts       Polymarket + Metaculus
│   │   ├── fec.ts               FEC campaign finance
│   │   ├── oira.ts              Federal Register + OIRA
│   │   ├── polling.ts           Wikipedia + RCP polling
│   │   └── whitehouse.ts        White House actions
│   ├── config.ts                API endpoints + constants
│   ├── httpClient.ts            Shared fetch wrapper
│   ├── textUtils.ts             HTML stripping, fuzzy match
│   ├── types.ts                 TypeScript definitions
│   ├── useAnalysis.ts           SSE hook for pipeline progress
│   └── watchlist.ts             Watchlist persistence
├── __tests__/                   Vitest test suite (84 tests)
├── data/watchlist.json          Saved watchlist tickers
└── results/                     Analysis reports (markdown)
```

## Pipeline

The analysis pipeline runs 4 subagents + 1 calibrator as Claude CLI subprocesses:

| Phase | Agent | Model | Searches | Role |
|---|---|---|---|---|
| 1 (seq) | Evidence | haiku | 7 | Factual research + fetcher tools |
| 1 (seq) | Devil's Advocate | haiku | 5 | Contrarian case, extends sources |
| 2 (par) | Resolution | sonnet | 1 | Criteria analysis, edge cases |
| 2 (par) | Chaos | haiku | 1 | Tail risks (1-8% scenarios) |
| 3 | Calibrator | sonnet | 0 | Synthesis, probability, bet sizing |

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
