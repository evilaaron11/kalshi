# Potential Accuracy Improvements

Brainstormed improvements to the prediction pipeline, roughly ordered by impact and feasibility.

---

## Implemented

### Agent-driven web search with search caps ✓
Agents search freely using WebSearch as their primary research tool rather than receiving pre-fetched articles. Evidence Agent is capped at 7 searches (breadth-first), Devil's Advocate at 5 (contrarian gaps only), Resolution and Chaos at 1 each, Calibrator at none. Replaced the static `news_fetcher.py` pipeline entirely.

### Sequential Phase 2 execution ✓
Resolution and Chaos agents run sequentially in the foreground instead of as background tasks. Background task polling failed silently on the first run, wasted ~3 minutes, and caused the Calibrator to run with incomplete input. Sequential foreground execution is fully reliable with negligible time cost.

### Primary source tools — executive actions ✓
`whitehouse_fetch.py`: scrapes whitehouse.gov RSS feeds and full page text for EOs, proclamations, press briefings, and official statements. `oira_agenda.py`: queries the Federal Register API and OIRA Unified Agenda XML for the regulatory pipeline. Both wired into the Evidence Agent prompt for all market types.

### Primary source tools — electoral markets ✓
`fec_fetch.py`: FEC public API for candidate campaign finance (cash on hand, total raised, burn rate). `polling_fetch.py`: Wikipedia election polling articles + RealClearPolitics for current averages. Both wired into the Evidence Agent prompt.

### Cross-market price signals ✓
`cross_market.py`: searches Polymarket (no auth) and Metaculus (token required) for matching markets by keyword. Returns platform, title, probability, volume, and URL. Wired into both Evidence Agent (always called) and Calibrator (CROSS-MARKET COMPARISON section, flags ≥5pp gaps as arbitrage). Polymarket confirmed working; Metaculus requires `METACULUS_TOKEN` env var.

---

## Highest Leverage (not yet built)

### 1. Base rate database
Build a SQLite table of past Kalshi markets (ticker, category, resolution, close_date, final_price_at_close). Agents can query: "how often do markets in this category priced at ~30% actually resolve YES?" This is reference class forecasting — the single biggest unlock in superforecasting methodology.

### 2. Economic indicator primary data
For CPI, jobs, Fed rate, and GDP markets: agents currently infer the data from articles that may be stale or summarized incorrectly. Direct sources:
- **FRED API** (fred.stlouisfed.org/docs/api): free, no key required, returns time-series data for thousands of economic indicators
- **BLS API** (bls.gov/developers): CPI, unemployment, PPI direct from the source
- **Fed meeting calendar + dot plot**: federalreserve.gov publishes the FOMC calendar and economic projections in machine-readable form

---

## Political Markets — Subtypes and Data Gaps

The pipeline has general web search and the four primary-source tools above, but each political subtype has specific data gaps worth filling.

### Executive actions (EOs, vetoes, pardons, tariffs, sanctions)
**What's built:** `whitehouse_fetch.py` for primary source text, `oira_agenda.py` for the regulatory pipeline.

**What's missing:**
- **Trump behavioral base rates**: hardcoded context in the Evidence Agent prompt about Trump 2.0 signing/veto/EO patterns. Key facts: ~220 EOs in term 1, rare vetoes (10 total), signs most Republican-backed legislation, uses IEEPA aggressively for tariffs/sanctions bypassing notice-and-comment. Worth encoding directly in the prompt for any market tagged as executive action.
- **Congressional calendar tool**: a market about "will Trump sign X by Y date" requires knowing when Congress is in session, when recess is, and when the legislative calendar has floor time for the bill. Congress.gov publishes this but it's not yet callable by agents.
- **OFAC sanctions list**: for sanctions markets, the OFAC SDN list is machine-readable XML at treasury.gov. Current status of sanctions targets is primary data, not news.

### Legislative (bill passage, budget, debt ceiling)
**What's built:** nothing specific — agents rely on web search.

**What's missing:**
- **`congress_status.py`**: Congress.gov API (api.congress.gov, free, requires key) returns bill stage, committee assignments, co-sponsors, recent votes, and floor schedule. This is the most important missing tool for legislative markets — "what stage is this bill at?" is answerable in one API call but requires multiple web searches.
- **Party loyalty / whip count data**: GovTrack publishes member ideology scores and historical defection rates. A bill with 5 likely Republican defectors in the Senate is a materially different market than one with 0.
- **Historical passage rates by stage**: how often do bills that pass committee actually become law? By party composition, by bill type? This is base rate data, not current news.

### Appointments and nominations
**What's built:** `whitehouse_fetch.py` catches nomination announcements from whitehouse.gov.

**What's missing:**
- **Senate committee hearing schedules**: the Senate Judiciary, Armed Services, etc. committees publish hearing schedules. For "will X be confirmed by Y date," knowing whether a hearing is scheduled is critical. Scrapeable from senate.gov committee pages.
- **Historical confirmation timelines**: how long do confirmations typically take by role (Cabinet, Circuit Judge, SCOTUS) and Senate composition? This is a small static dataset worth building once.
- **Nominee vetting signals**: FBI background check completion, financial disclosure filing status — these are public signals of whether a nomination is on track.

### Electoral (who wins, seat counts, margins)
**What's built:** `fec_fetch.py` for fundraising, `polling_fetch.py` for averages.

**What's missing:**
- **Cook/Sabato ratings**: Cook Political Report and Sabato's Crystal Ball publish race ratings (Safe R, Lean D, Toss-up, etc.). These are the canonical expert judgments that heavily influence Kalshi pricing. No public API but scrapeable.
- **Early voting data**: Michael McDonald's US Elections Project (electproject.org) has early voting totals and party registration breakdowns during active elections. Very high signal during an active election window, zero signal otherwise.
- **MIT Election Lab historical data**: district-level voting history going back decades. Buildable as a SQLite lookup that agents can query for "what's the baseline R+D in this district?" — reference class forecasting for electoral markets.
- **Redistricting / PVI data**: Dave's Redistricting App publishes partisan lean scores for every House district. For House seat count markets, this is the anchor.

### Legal and regulatory (indictments, court rulings, agency decisions)
**What's built:** `oira_agenda.py` covers regulatory pipeline.

**What's missing:**
- **PACER docket status**: federal court filings and docket events. Requires a PACER account (~$0.10/page) but critical for any market about a specific case (indictments, appeals, injunctions). The CourtListener API (courtlistener.com) is a free alternative that covers many federal courts.
- **Federal Register comment period tracker**: for markets about whether a rule will be finalized, the comment period close date and comment volume are leading indicators. Federal Register API already covers this partially.

### Personnel (resignations, firings, retirements)
**What's built:** `whitehouse_fetch.py` catches official announcements.

**What's missing:**
- No structured data source exists for this subtype — it's inherently event-driven. The gap here is signal quality in web search (official statements vs. rumors) rather than missing structured data. The most useful addition would be: official congressional testimony transcripts (congress.gov has these) since resignation signals often appear there first.

---

## Medium-term

### 4. Self-calibration tracking
Log every prediction (market, estimated probability, market price, date). After resolution, record the outcome. Over time, compute a calibration curve — if 70% calls resolve YES only 55% of the time, discount estimates systematically. Feed your own track record back into the Calibrator prompt.

### 5. Price history as a feature
Kalshi's API has market history. A market at 60% two weeks ago that's now at 30% tells a different story than one stable at 30%. Direction and velocity of price movement is a signal the agents currently can't see at all.

### 6. Iterative research loop
The current pipeline is one-shot. An upgrade: after the Evidence Agent finishes, check if it flagged knowledge gaps, then spawn a targeted follow-up search before the Calibrator runs.

---

## Harder / Longer-term

### 7. Fine-tuned resolution classifier
Accumulate resolved Kalshi markets, then fine-tune a small model on "given these facts, does this resolution criteria trigger YES?" The Resolution Agent's job, but LLMs hallucinate edge cases. A classifier trained on real Kalshi resolution outcomes would be more reliable.

### 8. Category-specific agent pipelines
Branch the pipeline by market category — each with specialized Evidence Agent prompts, the right subset of data tools pre-loaded, and a category-specific base rate table. More maintenance overhead, but meaningfully better accuracy per category. The political subtype breakdown above is the design spec for this.

---

## Quick Wins (implementable now)

- **Volume-weighted market trust**: high-volume markets are more efficient than low-volume ones — the Calibrator should trust the market price more for the former
- **Days-to-close as explicit context**: a market closing tomorrow is nearly resolved; one closing in 8 months is wide open. Agents don't currently reason about this gap explicitly
- **Trump behavioral base rates in prompt**: hardcode key Trump 2.0 signing/veto/EO patterns directly into the Evidence Agent prompt as prior context for executive action markets — no tool needed, just text
