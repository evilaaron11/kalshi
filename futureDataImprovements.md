# Future Data Improvements

Ranked datasets and signals to add to the analysis pipeline, grouped by build difficulty. Each dataset is an **epic** broken into small stories. Stories are sized to be completable in a single session.

**Pattern for new fetchers:** Create `lib/fetchers/<name>.ts`, wire into `cli.ts` with a new command, add to `FETCHER_DOCS` in `prompts.ts`, add `classifyTool` case in `pipeline.ts`, write tests in `__tests__/`.

---

## Implemented (Easy Tier) — completed 2026-03-20

All 9 easy epics were built using a 4-phase multi-agent workflow. 226 tests across 17 files, all passing.

### What was built

| Epic | Status | File(s) | Tests | Notes |
|------|--------|---------|-------|-------|
| 1. Congress.gov | ✅ Done | `lib/fetchers/congress.ts` | 26 in `congress.test.ts` | `searchBills`, `getBillDetails`, `getFloorSchedule`, `getPrognosis` (GovTrack) |
| 2. FRED | ✅ Done | `lib/fetchers/fred.ts` | 16 in `fred.test.ts` | `getSeries` (with shorthand map), `searchSeries`, `getReleaseDates` |
| 3. Confirmations | ✅ Done | `lib/fetchers/confirmations.ts`, `data/confirmations.json` (80 records) | 18 in `confirmations.test.ts` | `searchConfirmations`, `getBaseRates`, `getAppointments` |
| 4+5. Senate | ✅ Done | `lib/fetchers/senate.ts` | 18 in `senate.test.ts` | `getMembers`, `getNominationVotes`, `getWhipEstimate` |
| 6. Cook PVI | ✅ Done | `lib/fetchers/pvi.ts`, `data/cook-pvi.json` (143 records) | 13 in `pvi.test.ts` | `getDistrictLean`, `getCompetitiveRaces` |
| 7. Manifold | ✅ Done | `lib/fetchers/crossMarket.ts` (extended) | 15 in `crossMarket.test.ts` | `searchManifold` added as 3rd cross-market platform |
| 8. GovTrack | ✅ Done | `lib/fetchers/congress.ts` (extended) | included in `congress.test.ts` | `getPrognosis` scrapes bill passage probability |
| 9. Recess | ✅ Done | `lib/fetchers/confirmations.ts`, `data/recess-appointments.json` (15 records) | included in `confirmations.test.ts` | `getAppointments` |

### Key implementation decisions

- **ProPublica deprecated** — Epics 4+5 were originally planned for ProPublica Congress API, which is now dead. Replaced with:
  - **Congress.gov API** for senator roster (`/member/congress/119`)
  - **senate.gov public XML** for confirmation vote data (no auth required)
- **Epic 5 descoped** — individual senator voting profiles (`getMemberProfile`, `getPartyLineBreakdown`) require per-senator roll call data not available from senate.gov XML summary. Deferred to medium tier if needed via senate.gov individual vote detail XML.
- **Epic 8 merged into Epic 1** — `getPrognosis()` lives in `congress.ts` since it extends bill data.
- **Epic 9 merged into Epic 3** — `getAppointments()` lives in `confirmations.ts` since it's the same domain.

### API keys required

| Key | Required? | Source |
|-----|-----------|--------|
| `CONGRESS_API_KEY` | Recommended | https://api.congress.gov — free, instant |
| `FRED_API_KEY` | **Required** for economic data | https://api.stlouisfed.org/api_key — free, instant |

No auth needed for: confirmations (static), PVI (static), Manifold, senate.gov XML, GovTrack scrape.

### Multi-agent execution log

```
Phase 1: Scaffold — pre-wired cli.ts, config.ts, types.ts, pipeline.ts, prompts.ts
Phase 2: 5 parallel agents (Congress, FRED, Confirmations, PVI, Manifold) — all succeeded
Phase 3: 3 agents (Senate, GovTrack extending congress.ts, Recess already done) — all succeeded
Phase 4: Integration — FETCHER_DOCS updated, classifyTool wired, .env.example updated, 226 tests green
Post-build: ProPublica removed, senate.ts rewritten for Congress.gov + senate.gov XML
```

---

## MCP Server: US Gov Open Data — integrated 2026-03-20

Added [`us-gov-open-data-mcp`](https://github.com/lzinga/us-gov-open-data-mcp) as an MCP server for Claude Code and pipeline agents. Provides 300+ tools across 40+ U.S. government APIs with built-in caching, rate limiting, and retry.

### Configuration

- **Project MCP config:** `.mcp.json` (project root)
- **VS Code MCP config:** `.vscode/mcp.json`
- **Modules loaded:** `fred, congress, fec, treasury, bls, bea, federalregister, regulations, senatelobbying, sec, govinfo, usaspending, fbi, census`

### What this covers (beyond custom fetchers)

| Module | What it adds | Relevant market types |
|--------|-------------|----------------------|
| `treasury` | Fiscal data, national debt, spending | Debt ceiling, government spending markets |
| `bls` | Labor statistics beyond FRED | Jobs report, wage growth markets |
| `bea` | GDP breakdowns, trade balance | GDP threshold, trade deficit markets |
| `federalregister` | Rules, proposed rules, EO tracking | Regulatory action, executive order markets |
| `regulations` | Public comment data on proposed rules | Rulemaking timeline markets |
| `senatelobbying` | Lobbying disclosures (replaces hard Epic 21) | Nomination vetting, conflict of interest |
| `sec` | SEC EDGAR filings | Financial regulation markets |
| `govinfo` | Congressional records, reports | Legislation, oversight markets |
| `usaspending` | Federal spending data | Budget, appropriations markets |
| `fbi` | Crime statistics | Public safety policy markets |
| `census` | Demographics, population data | Electoral demographic analysis |

### API keys for MCP server

| Key | Required? | Source | Covers |
|-----|-----------|--------|--------|
| `DATA_GOV_API_KEY` | Recommended | https://api.data.gov/signup/ | Congress.gov, FEC, FDA, FBI, GovInfo, NREL, Regulations.gov, USDA FoodData |
| `FRED_API_KEY` | Already have | (reused from custom fetcher) | FRED |
| `BEA_API_KEY` | Optional | https://apps.bea.gov/API/signup/ | BEA GDP/trade data |
| `BLS_API_KEY` | Optional | https://www.bls.gov/developers/home.htm | BLS (higher rate limits) |
| `CENSUS_API_KEY` | Optional | https://api.census.gov/data/key_signup.html | Census |

20+ APIs require no key at all (Treasury, FDIC, Federal Register, Senate Lobbying, SEC, USAspending, etc.)

### How agents access it

- **Claude Code sessions** (CLI + VS Code): MCP tools are available automatically via `.mcp.json`
- **Pipeline agents**: Claude CLI subprocesses inherit MCP server config when spawned from a project with `.mcp.json`
- **Custom fetchers remain primary**: Agents use curated `FETCHER_DOCS` tools first. MCP server provides fallback access to the long tail of government data.

### Medium/hard epics made redundant

| Epic | Status | Replaced by |
|------|--------|-------------|
| 12. Federal Register bulk data | **Covered** | `federalregister` module |
| 16. LegiScan | **Partially covered** | `congress` module (federal only, no state) |
| 21. Lobbying disclosures (LDA) | **Covered** | `senatelobbying` module |

---

## Medium

### Epic 10: Senate Committee Hearing Schedules
**Impact:** High | **Coverage:** High
Hearing scheduled = ~95% confirmation rate. Strongest binary signal for nomination markets.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 10.1 | Research senate.gov hearing page structure, identify scrapeable endpoints | Document URL patterns and HTML structure |
| 10.2 | Create `lib/fetchers/hearings.ts` with `getUpcomingHearings(committee?)` | Scrape senate.gov, return date, committee, topic, witnesses |
| 10.3 | Add `searchHearings(query)` — keyword search across upcoming hearings | Returns matching hearings |
| 10.4 | Add `getNomineeHearingStatus(nomineeName)` — check if a hearing is scheduled for a specific nominee | Returns hearing date if found, null if not |
| 10.5 | Wire into CLI: `npx tsx lib/fetchers/cli.ts hearings --search "Pete Hegseth" [--committee "Armed Services"]` | CLI prints results |
| 10.6 | Add to `FETCHER_DOCS` in `prompts.ts` | Agents call for any nomination market |
| 10.7 | Add `classifyTool` case in `pipeline.ts` | UI shows "Hearing lookup: ..." |
| 10.8 | Write tests with mocked HTML responses | ≥6 tests |

---

### Epic 11: Historical Prediction Market Prices
**Impact:** High | **Coverage:** Universal
Calibration base rates: "when markets were at X% at this point before close, they resolved YES Y% of the time."

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 11.1 | Download and parse PredictIt historical price archive (CSV bulk data) | Store as `data/predictit-historical.json` — market title, category, open/close dates, daily prices, resolution |
| 11.2 | Download Polymarket resolved market data via gamma API | Append to historical dataset |
| 11.3 | Create `lib/fetchers/calibration.ts` with `getBaseRate(price, daysToClose, category?)` | Given a current price and days to close, return historical resolution rate for markets in similar situations |
| 11.4 | Add `getSimilarMarkets(query, resolved?)` — find historically similar markets | Returns matching resolved markets with their price trajectory and outcome |
| 11.5 | Wire into CLI: `npx tsx lib/fetchers/cli.ts calibration --price 65 --days 30 [--category politics]` | CLI prints base rate and similar markets |
| 11.6 | Add to Calibrator prompt specifically (not all agents) | Calibrator uses base rates as a sanity check |
| 11.7 | Write tests: base rate computation, bucketing, edge cases | ≥6 tests |

---

### Epic 12: Federal Register Bulk Data
**Impact:** Medium | **Coverage:** Medium
Extends existing OIRA fetcher with historical rulemaking velocity analysis.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 12.1 | Add `getRulemakingTimeline(agencyOrTopic)` to `oira.ts` — historical time from proposed rule to final rule | Returns avg days, median days, range for matching rules |
| 12.2 | Add `getEOFrequency(president?, year?)` — executive order signing velocity | Returns EOs per month/quarter for calibrating "will X EO happen by Y" markets |
| 12.3 | Wire into CLI as subcommands of existing `oira` command | `oira --timeline "EPA climate"`, `oira --eo-frequency --president "Biden"` |
| 12.4 | Write tests | ≥4 tests |

---

### Epic 13: 538 / Silver Bulletin Model Outputs
**Impact:** Medium | **Coverage:** Medium
Election model probabilities when races are active.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 13.1 | Research current Silver Bulletin page structure | Document scrapeable URLs and data format |
| 13.2 | Create `lib/fetchers/electionModels.ts` with `getModelForecast(race)` | Returns win probability, tipping point states, simulated outcomes |
| 13.3 | Wire into CLI: `npx tsx lib/fetchers/cli.ts models --race "2026 Georgia Senate"` | CLI prints model forecast |
| 13.4 | Add to `FETCHER_DOCS` — agents use for electoral markets | Guidance on when model data is/isn't available |
| 13.5 | Write tests with mocked responses | ≥4 tests |

---

### Epic 14: Trade Policy Trackers
**Impact:** Medium | **Coverage:** Low-Medium
Peterson Institute tariff database for tariff-specific markets.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 14.1 | Research Peterson Institute / Chad Bown tariff DB access | Document data format and access method |
| 14.2 | Create `lib/fetchers/trade.ts` with `getTariffStatus(country?, product?)` | Returns current tariff rates, pending actions, timelines |
| 14.3 | Add `getTradeActions(search)` — recent trade-related executive/regulatory actions | Returns actions with dates, affected products/countries |
| 14.4 | Wire into CLI and `FETCHER_DOCS` | Agents use for tariff markets |
| 14.5 | Write tests | ≥4 tests |

---

### Epic 15: Interest Group Scorecards
**Impact:** Low-Medium | **Coverage:** Medium
Predict opposition coalitions for nominees.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 15.1 | Compile scorecard data into `data/scorecards.json`: senator, Heritage Action %, NRA grade, ACLU score, League of Conservation Voters % | All current senators |
| 15.2 | Create `lib/fetchers/scorecards.ts` with `getSenatorScores(name)` and `getIdeologicalProfile(name)` | Returns all scores + overall lean classification |
| 15.3 | Add `getPotentialOpposition(nomineeType)` — senators most likely to oppose based on ideology | Returns ranked list of likely no votes |
| 15.4 | Wire into CLI and `FETCHER_DOCS` | Agents combine with whip count for nomination markets |
| 15.5 | Write tests | ≥4 tests |

---

### Epic 16: LegiScan
**Impact:** Low-Medium | **Coverage:** Medium
Adds state-level bill tracking. Overlaps Congress.gov for federal.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 16.1 | Create `lib/fetchers/legiscan.ts` with `searchBills(query, state?)` | Returns state + federal bill matches |
| 16.2 | Wire into CLI: `npx tsx lib/fetchers/cli.ts legiscan --search "abortion" --state TX` | CLI prints results |
| 16.3 | Add `LEGISCAN_API_KEY` to `.env.example` | Documented |
| 16.4 | Write tests | ≥4 tests |

---

### Epic 17: SCOTUS Docket
**Impact:** Medium | **Coverage:** Low
Case ruling timeline markets.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 17.1 | Research SCOTUS docket data sources (supremecourt.gov, oyez.org API) | Document best scrapeable source |
| 17.2 | Create `lib/fetchers/scotus.ts` with `getPendingCases(term?)` | Returns case name, docket #, issue area, argument date, expected decision date |
| 17.3 | Add `getCaseStatus(caseName)` — current status of a specific case | Returns oral argument date, briefs filed, likely decision window |
| 17.4 | Wire into CLI and `FETCHER_DOCS` | Agents use for SCOTUS markets |
| 17.5 | Write tests | ≥4 tests |

---

## Hard

### Epic 18: OGE Financial Disclosures (PDF Extraction)
**Impact:** Medium | **Coverage:** Medium

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 18.1 | Research OGE disclosure PDF structure and access URLs | Document format, identify structured vs. free-text sections |
| 18.2 | Build PDF downloader for nominee disclosures | Given nominee name, download PDF from OGE |
| 18.3 | Build PDF-to-text extractor (use pdf-parse or similar) | Extract structured fields: assets, liabilities, positions held |
| 18.4 | Add conflict-of-interest flag detection | Flag potential conflicts based on assets vs. position |
| 18.5 | Wire into CLI and `FETCHER_DOCS` | Agents call for nomination markets |
| 18.6 | Write tests with sample PDFs | ≥4 tests |

---

### Epic 19: L2 Voter File Data
**Impact:** Medium | **Coverage:** Low-Medium
Commercial data, requires paid subscription.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 19.1 | Evaluate L2 pricing and data access (API vs. bulk) | Decision doc: cost, update frequency, coverage |
| 19.2 | If approved: build `lib/fetchers/voterFile.ts` with `getRegistrationTrends(state, timeframe)` | Returns new registrations by party, net party switching |
| 19.3 | Add `getTurnoutEstimate(state, district?)` — modeled turnout based on registration trends | Returns estimated turnout range |
| 19.4 | Wire into CLI and `FETCHER_DOCS` | Agents use for electoral markets |
| 19.5 | Write tests | ≥4 tests |

---

### Epic 20: C-SPAN Hearing Transcripts
**Impact:** Low-Medium | **Coverage:** Low-Medium

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 20.1 | Research C-SPAN transcript access (API vs. scrape) | Document access method and transcript format |
| 20.2 | Build transcript downloader for a given hearing | Returns full text of hearing |
| 20.3 | Build summary extractor — key questions, senator tone, nominee responses | Use Claude to summarize long transcripts into actionable signals |
| 20.4 | Wire into CLI and `FETCHER_DOCS` | Agents call after a hearing has occurred |
| 20.5 | Write tests | ≥3 tests |

---

### Epic 21: Lobbying Disclosures (LDA Filings)
**Impact:** Low | **Coverage:** Low

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 21.1 | Research Senate.gov LDA bulk data format | Document download URLs and schema |
| 21.2 | Build `lib/fetchers/lobbying.ts` with `searchLobbyist(name)` and `searchClient(company)` | Returns registrations, issues lobbied, amounts |
| 21.3 | Add `getNomineeLobbying(name)` — prior lobbying ties for a nominee | Returns lobbying history if any |
| 21.4 | Wire into CLI and `FETCHER_DOCS` | Agents call for nomination vetting |
| 21.5 | Write tests | ≥3 tests |
