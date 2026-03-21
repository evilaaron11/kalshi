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
│  │  │  ChatWidget     │      │  /api/chat              POST    │   │  │
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
│  │  │         ├── oira.ts        ── congress.ts        ││     │ │   │  │
│  │  │         ├── fred.ts        ── senate.ts          ││     │ │   │  │
│  │  │         ├── confirmations.ts ── pvi.ts           ││     │ │   │  │
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
│  │  │ + MCP gov data        │  │   │  «external» Data Sources  │   │  │
│  │  ├───────────────────────┤  │   │                           │   │  │
│  │  │ «agent» Devil's Advoc.│  │   │  Polymarket (gamma API)   │   │  │
│  │  │ haiku · 5 searches    │  │   │  Metaculus  (REST API)    │   │  │
│  │  ├───────────────────────┤  │   │  Manifold   (REST API)    │   │  │
│  │  │ «agent» Resolution    │  │   │  FEC        (open.fec.gov)│   │  │
│  │  │ sonnet · 1 search     │──┼──▶│  Congress.gov (REST API)  │   │  │
│  │  ├───────────────────────┤  │   │  FRED       (REST API)    │   │  │
│  │  │ «agent» Chaos         │  │   │  Fed Register (JSON API)  │   │  │
│  │  │ haiku · 1 search      │  │   │  OIRA       (XML feed)    │   │  │
│  │  ├───────────────────────┤  │   │  White House (RSS feeds)  │   │  │
│  │  │ «agent» Calibrator    │  │   │  senate.gov  (XML)        │   │  │
│  │  │ opus · MCP gov data   │  │   │  Wikipedia  (MediaWiki)   │   │  │
│  │  └───────────────────────┘  │   │  RCP        (HTML scrape) │   │  │
│  └─────────────────────────────┘   └───────────────────────────┘   │  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │           «external» US Gov Open Data MCP Server                │   │
│  │  npx us-gov-open-data-mcp --modules fred,congress,fec,...       │   │
│  │  300+ tools: Treasury, BLS, BEA, Fed Register, SEC, Lobbying   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     «storage» File System                        │  │
│  │  data/watchlist.json          results/YYYY-MM-DD_HHMM_TICKER.md │  │
│  │  data/confirmations.json      data/cook-pvi.json                 │  │
│  │  data/recess-appointments.json                                   │  │
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
     │            │              │                │  MCP tools──┼──>│ Gov API│
     │◄╌╌ progress: Searching╌╌╌│◄╌╌stream-json╌╌│            │  run()     │
     │◄╌╌ progress: Reasoning╌╌╌│◄╌╌╌╌╌╌╌╌╌╌╌╌╌╌│            │◄──│        │
     │◄╌╌ progress: Fetcher ╌╌╌╌│◄╌╌╌╌╌╌╌╌╌╌╌╌╌╌│            │            │
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
     │            │              │                │  MCP tools──┼──>│ Gov API│
     │◄╌╌ progress: Reasoning╌╌╌│◄╌╌stream-json╌╌│            │            │
     │            │              │◄───────────────│ final report│            │
     │◄╌╌ stage: calibrator done│               │             │            │
     │            │              │               │             │            │
     │            │              │ saveReport()  │             │            │
     │            │              │──────────────>│ results/*.md │            │
     │◄╌╌ event: complete ╌╌╌╌╌╌│               │             │            │
     │            │              │               │             │            │
```

### File Structure

```
├── app/                         Pages & API routes
│   ├── page.tsx                 Dashboard
│   └── api/
│       ├── markets/             CRUD + live Kalshi prices
│       ├── analyze/             Pipeline orchestration + SSE
│       └── chat/                Analysis chatbot (streams via Claude CLI)
├── components/                  React UI
│   ├── MarketCard.tsx           Market display + analysis trigger
│   ├── ReportViewer.tsx         Structured report rendering
│   ├── ProgressStepper.tsx      Pipeline stage indicators
│   ├── StageDetail.tsx          Per-stage activity feed (tools + reasoning)
│   ├── ReportSection.tsx        Collapsible section wrapper
│   ├── RichText.tsx             Inline markdown renderer
│   ├── OutcomeBar.tsx           Event outcome probability bar
│   ├── ChatWidget.tsx           Analysis chatbot widget
│   └── AddMarketModal.tsx       URL input modal
├── lib/
│   ├── kalshi.ts                Kalshi API client (RSA auth)
│   ├── pipeline.ts              Agent orchestration (Claude CLI)
│   ├── prompts.ts               Agent prompt templates
│   ├── reportParser.ts          Report text → structured data
│   ├── richTextUtils.ts         Markdown tokenizer + bullet parser
│   ├── fetchers/                Primary-source data fetchers
│   │   ├── cli.ts               CLI entry point for agents
│   │   ├── crossMarket.ts       Polymarket + Metaculus + Manifold
│   │   ├── fec.ts               FEC campaign finance
│   │   ├── oira.ts              Federal Register + OIRA
│   │   ├── polling.ts           Wikipedia + RCP polling
│   │   ├── whitehouse.ts        White House actions
│   │   ├── congress.ts          Congress.gov bills + floor schedule + GovTrack prognosis
│   │   ├── fred.ts              FRED economic data (CPI, GDP, rates, jobs)
│   │   ├── confirmations.ts     Historical confirmation outcomes + recess appointments
│   │   ├── senate.ts            Senate roster + confirmation votes + whip estimates
│   │   └── pvi.ts               Cook PVI partisan lean scores
│   ├── config.ts                API endpoints + constants
│   ├── httpClient.ts            Shared fetch wrapper
│   ├── textUtils.ts             HTML stripping, fuzzy match
│   ├── types.ts                 TypeScript definitions
│   ├── useAnalysis.ts           SSE hook for pipeline progress
│   ├── useChat.ts               Chat hook for analysis chatbot
│   └── watchlist.ts             Watchlist persistence
├── data/
│   ├── watchlist.json           Saved watchlist tickers
│   ├── confirmations.json       Historical confirmation outcomes (80 records)
│   ├── cook-pvi.json            Cook PVI scores (143 records)
│   └── recess-appointments.json Recess appointment history (15 records)
├── __tests__/                   Vitest test suite (226+ tests across 17 files)
├── results/                     Analysis reports (markdown)
├── .mcp.json                    MCP server config (US Gov Open Data)
├── .vscode/mcp.json             VS Code MCP server config
├── .env                         Environment variables (gitignored)
├── .env.example                 Documented env var template
├── futureDataImprovements.md    Planned datasets + implementation epics
├── design.md                    UI/UX design document
├── package.json
├── tsconfig.json
├── next.config.ts
└── postcss.config.mjs
```

## Pipeline

The analysis pipeline runs 4 subagents + 1 calibrator as Claude CLI subprocesses:

| Phase | Agent | Model | Tools | Role |
|---|---|---|---|---|
| 1 (seq) | Evidence | haiku | 7 web searches + fetchers + MCP gov data | Factual research |
| 1 (seq) | Devil's Advocate | haiku | 5 web searches + fetchers | Contrarian case, extends sources |
| 2 (par) | Resolution | sonnet | 1 web search | Criteria analysis, edge cases |
| 2 (par) | Chaos | haiku | 1 web search | Tail risks (1-8% scenarios) |
| 3 | Calibrator | opus | MCP gov data (targeted lookups only) | Synthesis, probability, bet sizing |

Supports both **single binary markets** and **multi-outcome events**.

The UI streams real-time progress including tool calls, reasoning text, and thinking — click any stage to expand its activity feed.

## Research Tools

### Custom Fetchers

Agents have access to specialized fetchers alongside web search. These don't count against search limits.

| Fetcher | Data Source | Use Case |
|---|---|---|
| `whitehouse` | Executive orders, briefings, statements from whitehouse.gov | Presidential actions, EOs, tariffs, nominations |
| `oira` | Federal Register + OIRA Unified Agenda | Agency rulemaking, regulatory deadlines |
| `fec` | FEC campaign finance (cash on hand, raised/spent, burn rate) | Election markets |
| `polling` | Wikipedia + RealClearPolitics polling averages | Electoral race markets |
| `cross-market` | Polymarket + Metaculus + Manifold prices | Cross-platform arbitrage detection |
| `congress` | Congress.gov bills, cosponsors, floor schedule, GovTrack prognosis | Legislation, shutdown, debt ceiling markets |
| `fred` | FRED economic data (CPI, GDP, unemployment, rates, 800k+ series) | Economic threshold markets |
| `confirmations` | Historical confirmation outcomes + recess appointments | Cabinet/judicial nomination markets |
| `senate` | Senate roster, confirmation votes, whip count estimates | "Does this nominee have the votes?" |
| `pvi` | Cook PVI partisan lean scores | Electoral race baselines |

Run fetchers directly:

```bash
npx tsx lib/fetchers/cli.ts cross-market --query "government shutdown"
npx tsx lib/fetchers/cli.ts whitehouse --search "tariffs" --type eos --limit 5
npx tsx lib/fetchers/cli.ts oira --search "EPA climate" --source fedreg
npx tsx lib/fetchers/cli.ts fec --candidate "Jon Ossoff" --office S --state GA
npx tsx lib/fetchers/cli.ts polling --race "Georgia Senate 2026"
npx tsx lib/fetchers/cli.ts congress --search "shutdown" --congress 119
npx tsx lib/fetchers/cli.ts congress --floor --chamber senate
npx tsx lib/fetchers/cli.ts fred --series "UNEMPLOYMENT" --limit 12
npx tsx lib/fetchers/cli.ts fred --releases --series "CPIAUCSL"
npx tsx lib/fetchers/cli.ts confirmations --position "Secretary of Defense"
npx tsx lib/fetchers/cli.ts senate --whip "cabinet"
npx tsx lib/fetchers/cli.ts pvi --state GA --district 6
```

### MCP Server: US Government Open Data

The Evidence and Calibrator agents also have access to 300+ government data tools via the [`us-gov-open-data-mcp`](https://github.com/lzinga/us-gov-open-data-mcp) MCP server. This provides fallback access to data the custom fetchers don't cover:

| Module | Data | Relevant Markets |
|---|---|---|
| `treasury` | National debt, fiscal data, spending | Debt ceiling, government spending |
| `bls` | Labor statistics, employment, wages | Jobs report, wage growth |
| `bea` | GDP breakdowns, trade balance | GDP threshold, trade deficit |
| `federalregister` | Published rules, proposed rules, EOs | Regulatory action, executive orders |
| `senatelobbying` | Lobbying disclosures | Nominee vetting, conflicts |
| `sec` | SEC EDGAR filings | Financial regulation |
| `usaspending` | Federal spending data | Budget, appropriations |

Custom fetchers are preferred (faster, curated). MCP tools are the long-tail fallback.

## Setup

**Requirements:** Node.js 20+, [Claude Code](https://claude.ai/code) (Claude Pro/Max).

```bash
npm install
```

Create `.env` (see `.env.example` for all options):

```
KALSHI_API_KEY=your_api_key
KALSHI_PRIVATE_KEY_PATH=./kalshi_private.pem.txt
```

Place your Kalshi RSA private key at the path specified above.

## Usage

### Web App

```bash
npm run dev
```

Open `http://localhost:3000`. Add markets to the watchlist, view live prices, and run the full analysis pipeline with real-time progress showing tool calls and agent reasoning.

### CLI

From Claude Code inside the project directory:

```
/analyze-market https://kalshi.com/markets/SOMEEVENT-TICKER
```

### Tests

```bash
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
| `POST` | `/api/chat` | Analysis chatbot (streams responses) |

## API Keys

| Key | Required | Source |
|---|---|---|
| `KALSHI_API_KEY` + RSA private key | Yes | [Kalshi API settings](https://kalshi.com/profile/api) |
| `DATA_GOV_API_KEY` | Recommended | [api.data.gov/signup](https://api.data.gov/signup/) — covers FEC, Congress.gov, FDA, FBI, GovInfo + more |
| `CONGRESS_API_KEY` | Recommended | [api.congress.gov](https://api.congress.gov) — free, instant |
| `FRED_API_KEY` | Required for economic data | [api.stlouisfed.org/api_key](https://api.stlouisfed.org/api_key) — free, instant |
| `METACULUS_TOKEN` | Optional | Enables Metaculus cross-market comparison |
| `BEA_API_KEY` | Optional | [apps.bea.gov/API/signup](https://apps.bea.gov/API/signup/) — GDP/trade data via MCP |
| `BLS_API_KEY` | Optional | [bls.gov/developers](https://www.bls.gov/developers/home.htm) — higher rate limits via MCP |

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
