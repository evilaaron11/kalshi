# Future Data Improvements

Ranked datasets and signals to add to the analysis pipeline, grouped by build difficulty. Each dataset is an **epic** broken into small stories. Stories are sized to be completable in a single session.

**Pattern for new fetchers:** Create `lib/fetchers/<name>.ts`, wire into `cli.ts` with a new command, add to `FETCHER_DOCS` in `prompts.ts`, add `classifyTool` case in `pipeline.ts`, write tests in `__tests__/`.

---

## Execution Plan (Easy Tier)

### Priority order

| Priority | Epic | Rationale |
|----------|------|-----------|
| 1 | Congress.gov (Epic 1) | Highest coverage — shutdown, debt ceiling, legislation markets are most common on Kalshi |
| 2 | FRED (Epic 2) | Second highest coverage — economic threshold markets (CPI, jobs, rates) are high-volume |
| 3 | Confirmations (Epic 3) | Directly enables cabinet/nomination markets. Static data = fast build. Needed before Epic 9 |
| 4 | Senate votes (Epic 4) | Whip count estimates are the most actionable signal for nomination markets. Pairs with Epic 3 |
| 5 | Manifold (Epic 7) | Quick win — extends existing `crossMarket.ts`. Improves every analysis |
| 6 | Cook PVI (Epic 6) | Static dataset, fast build. Baseline for all electoral markets |
| 7 | ProPublica voting records (Epic 5) | Extends Epic 4's `senate.ts`. Adds depth but Epic 4 alone covers most nomination needs |
| 8 | GovTrack prognosis (Epic 8) | Extends Epic 1's `congress.ts`. Nice-to-have on top of raw bill data |
| 9 | Recess appointments (Epic 9) | Tiny dataset, rare event. Trivial build but lowest impact |

### Multi-agent workflow

4 phases, maximizing parallelism while respecting dependencies. Each parallel agent runs in an isolated git worktree.

```
Phase 1: Scaffold (1 agent, serial)
│   - Pre-wire cli.ts with placeholder routing for all 7 new commands
│   - Add empty FETCHER_DOCS sections in prompts.ts
│   - Add classifyTool cases in pipeline.ts
│   - Prevents merge conflicts when parallel agents edit shared files
│
├───────┬───────┬────────┬─────────┐
▼       ▼       ▼        ▼         ▼
Congress  FRED  Confirms   PVI    Manifold    ← Phase 2 (5 parallel agents)
(Ep 1)  (Ep 2)  (Ep 3)  (Ep 6)   (Ep 7)
│                │
▼                ▼
GovTrack      Recess     Senate               ← Phase 3 (3 agents)
(Ep 8)        (Ep 9)    (Ep 4+5)
│              │           │
└──────┬───────┴───────────┘
       ▼
Phase 4: Integration (1 agent, serial)
    - Merge all branches, resolve conflicts
    - Fill in FETCHER_DOCS with real usage docs
    - Update .env.example with new keys
    - Run full test suite
    - Update README.md and design.md
```

**Phase 2** — 5 agents build in parallel. Zero shared code between them:
- Agent A: `lib/fetchers/congress.ts` + `__tests__/congress.test.ts`
- Agent B: `lib/fetchers/fred.ts` + `__tests__/fred.test.ts`
- Agent C: `data/confirmations.json` + `lib/fetchers/confirmations.ts` + `__tests__/confirmations.test.ts`
- Agent D: `data/cook-pvi.json` + `lib/fetchers/pvi.ts` + `__tests__/pvi.test.ts`
- Agent E: Extends `lib/fetchers/crossMarket.ts` with Manifold + `__tests__/crossMarket.test.ts`

**Phase 3** — 3 agents, partially parallel:
- Agent F: `lib/fetchers/senate.ts` + `__tests__/senate.test.ts` (independent, runs in parallel)
- Agent G: Extends `congress.ts` from Agent A with `getPrognosis()` (waits on Phase 2)
- Agent H: Extends `confirmations.ts` from Agent C with `getAppointments()` (waits on Phase 2)

**Risks and mitigations:**

| Risk | Mitigation |
|------|------------|
| Merge conflicts in shared files | Phase 1 scaffold pre-wires all shared files; agents only edit their own module |
| Static data quality (Epics 3, 6, 9) | Agents use web search to compile data, cross-reference multiple sources |
| API auth issues | Each agent tests against real API in its worktree before committing |
| Prompt bloat in FETCHER_DOCS | Phase 4 agent reviews total token count, keeps docs concise |

---

## Easy

### Epic 1: Congress.gov API
**Impact:** High | **Coverage:** Very high
Covers shutdown, debt ceiling, "will X bill pass" markets. Free API, no key required (rate-limited to 5k/hr).

**API base:** `https://api.congress.gov/v3`

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 1.1 | Create `lib/fetchers/congress.ts` with `searchBills(query, congress?, limit?)` | Returns bill number, title, status, latest action, sponsor, cosponsor count, committees |
| 1.2 | Add `getBillDetails(billId)` to fetch full bill info | Returns full action history, all cosponsors with party, related bills, CBO score URL if available |
| 1.3 | Add `getFloorSchedule()` for House and Senate | Returns upcoming floor actions with dates, bill numbers, and expected action type |
| 1.4 | Wire into CLI: `npx tsx lib/fetchers/cli.ts congress --search "shutdown" [--congress 119] [--limit 10]` | CLI prints JSON, handles errors |
| 1.5 | Add CLI subcommand: `congress --floor [--chamber house\|senate]` | Returns upcoming scheduled votes |
| 1.6 | Add to `FETCHER_DOCS` in `prompts.ts` with usage guidance | Agents know when/how to call it |
| 1.7 | Add `classifyTool` case in `pipeline.ts` for progress display | UI shows "Congress lookup: ..." during runs |
| 1.8 | Write tests: mock API responses, CLI arg parsing, error handling | ≥8 tests covering search, details, floor, errors |

---

### Epic 2: FRED Economic Data
**Impact:** High | **Coverage:** Very high
Covers CPI, jobs, GDP, rate decision, unemployment markets. Free API key from `api.stlouisfed.org`.

**API base:** `https://api.stlouisfed.org/fred`

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 2.1 | Create `lib/fetchers/fred.ts` with `getSeries(seriesId, limit?)` | Returns recent observations (date, value) for any FRED series |
| 2.2 | Add `searchSeries(query, limit?)` to find relevant series IDs | Returns series ID, title, frequency, last updated, units |
| 2.3 | Add hardcoded series map for common Kalshi indicators: `CPI` → CPIAUCSL, `UNEMPLOYMENT` → UNRATE, `GDP` → GDP, `FED_RATE` → FEDFUNDS, `NONFARM_PAYROLLS` → PAYEMS | Agents can use shorthand names instead of memorizing series IDs |
| 2.4 | Add `getReleaseDates(seriesId)` — next scheduled data release | Returns upcoming release dates so agents know when the number drops |
| 2.5 | Wire into CLI: `npx tsx lib/fetchers/cli.ts fred --series "UNRATE" [--limit 12]` | CLI prints JSON time series |
| 2.6 | Add CLI subcommand: `fred --search "consumer price index" [--limit 5]` | Returns matching series |
| 2.7 | Add CLI subcommand: `fred --releases --series "CPIAUCSL"` | Returns next release date |
| 2.8 | Add to `FETCHER_DOCS` in `prompts.ts` | Agents know the shorthand map and when to use FRED |
| 2.9 | Add `classifyTool` case in `pipeline.ts` | UI shows "FRED lookup: ..." |
| 2.10 | Add `FRED_API_KEY` to `.env.example` and `config.ts` | Documented, with fallback error message if missing |
| 2.11 | Write tests: mock series data, search, release dates, shorthand resolution | ≥8 tests |

---

### Epic 3: Historical Confirmation Outcomes
**Impact:** High | **Coverage:** Medium
Static dataset of every cabinet/judicial nominee outcome since Reagan. Enables calibration like "95% of nominees with a scheduled hearing get confirmed."

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 3.1 | Research and compile dataset: nominee name, position, president, year nominated, year resolved, outcome (confirmed/withdrawn/rejected), days to confirmation, senate vote margin, committee vote | JSON file in `data/confirmations.json`, ≥150 entries |
| 3.2 | Create `lib/fetchers/confirmations.ts` with `searchConfirmations(position?, president?, outcome?)` | Filters dataset, returns matching records |
| 3.3 | Add `getBaseRates(position)` — computes confirmation rate, avg days, avg margin for a position type | Returns `{ confirmationRate, avgDays, avgMargin, totalCount }` |
| 3.4 | Wire into CLI: `npx tsx lib/fetchers/cli.ts confirmations --position "Secretary of Defense" [--president "Trump"]` | CLI prints filtered records + base rates |
| 3.5 | Add to `FETCHER_DOCS` in `prompts.ts` | Agents call it for any nomination market |
| 3.6 | Add `classifyTool` case in `pipeline.ts` | UI shows "Confirmation lookup: ..." |
| 3.7 | Write tests: filtering, base rate computation, edge cases (no matches) | ≥6 tests |

---

### Epic 4: Senator Nomination Vote History
**Impact:** High | **Coverage:** Medium
Via ProPublica Congress API. Enables whip count estimates per nominee.

**API base:** `https://api.propublica.org/congress/v1`

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 4.1 | Create `lib/fetchers/senate.ts` with `getMembers(congress?, chamber?)` | Returns current senators: name, party, state |
| 4.2 | Add `getNominationVotes(congress?)` — all nomination roll call votes | Returns vote ID, nominee description, result, date, vote counts |
| 4.3 | Add `getMemberVotePositions(memberId, voteId)` — how a specific senator voted | Returns yes/no/not voting per senator for a given vote |
| 4.4 | Add `getWhipEstimate(nomineeType)` — compute likely vote breakdown based on historical patterns | Returns estimated yes/no/uncertain counts by party, list of swing senators |
| 4.5 | Wire into CLI: `npx tsx lib/fetchers/cli.ts senate --votes [--congress 119] [--limit 10]` | CLI prints recent nomination votes |
| 4.6 | Add CLI subcommand: `senate --members [--party R\|D\|I]` | Returns current senate roster |
| 4.7 | Add to `FETCHER_DOCS` in `prompts.ts` | Agents call it for nomination/confirmation markets |
| 4.8 | Add `PROPUBLICA_API_KEY` to `.env.example` and `config.ts` | Documented |
| 4.9 | Add `classifyTool` case in `pipeline.ts` | UI shows "Senate lookup: ..." |
| 4.10 | Write tests: mock API, member filtering, vote parsing | ≥8 tests |

---

### Epic 5: ProPublica Congress API (Voting Records)
**Impact:** Medium | **Coverage:** High
Extends Epic 4 beyond nominations to general voting patterns and party-line analysis.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 5.1 | Add `getRecentVotes(chamber, limit?)` to `senate.ts` | Returns recent roll call votes: bill, result, party breakdown |
| 5.2 | Add `getMemberProfile(memberId)` — voting stats, party loyalty %, missed votes % | Returns member profile with loyalty and bipartisanship metrics |
| 5.3 | Add `getPartyLineBreakdown(voteId)` — who crossed party lines | Returns list of crossover voters with party and state |
| 5.4 | Wire into CLI: `senate --profile "Susan Collins"` and `senate --recent-votes [--chamber senate]` | CLI prints results |
| 5.5 | Update `FETCHER_DOCS` with new subcommands | Agents can query voting patterns |
| 5.6 | Write tests for new functions | ≥5 tests |

---

### Epic 6: Cook PVI / Partisan Lean Scores
**Impact:** Medium | **Coverage:** High
Static dataset updated yearly. Baseline for any House/Senate race market.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 6.1 | Compile Cook PVI scores into `data/cook-pvi.json`: district/state, PVI score, lean direction, incumbent, incumbent party | All 435 House districts + 50 states for Senate |
| 6.2 | Create `lib/fetchers/pvi.ts` with `getDistrictLean(state, district?)` | Returns PVI score, incumbent info |
| 6.3 | Add `getCompetitiveRaces(threshold?)` — all races within ±N PVI points | Returns sorted list of toss-up / lean districts |
| 6.4 | Wire into CLI: `npx tsx lib/fetchers/cli.ts pvi --state GA [--district 6]` | CLI prints lean data |
| 6.5 | Add to `FETCHER_DOCS` in `prompts.ts` | Agents use for electoral markets |
| 6.6 | Write tests | ≥5 tests |

---

### Epic 7: Manifold Markets API
**Impact:** Medium | **Coverage:** High
Additional cross-market source. Free, no auth required.

**API base:** `https://api.manifold.markets/v0`

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 7.1 | Add `searchManifold(query, limit?)` to `lib/fetchers/crossMarket.ts` | Returns title, probability, volume, URL for matching markets |
| 7.2 | Integrate into existing `searchCrossMarket()` alongside Polymarket + Metaculus | Combined results include Manifold markets |
| 7.3 | Update cross-market output format to include platform name per result | Agents see which platform each price comes from |
| 7.4 | Write tests: mock Manifold API response, integration with existing cross-market | ≥4 tests |

---

### Epic 8: GovTrack Prognosis Scores
**Impact:** Medium | **Coverage:** Medium
ML-generated bill passage probabilities from GovTrack.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 8.1 | Add `getPrognosis(billId)` to `lib/fetchers/congress.ts` — scrape GovTrack prognosis page | Returns passage probability %, factors, last updated |
| 8.2 | Integrate into `searchBills()` output when available | Bill search results include prognosis score when GovTrack has one |
| 8.3 | Write tests with mocked HTML | ≥3 tests |

---

### Epic 9: Recess Appointment History
**Impact:** Low | **Coverage:** Low
Tiny static dataset, trivial to add.

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| 9.1 | Compile recess appointments into `data/recess-appointments.json`: president, nominee, position, date, context | All modern-era recess appointments (~30 entries) |
| 9.2 | Add `getAppointments(president?, position?)` to `confirmations.ts` | Returns filtered records |
| 9.3 | Write tests | ≥2 tests |

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
