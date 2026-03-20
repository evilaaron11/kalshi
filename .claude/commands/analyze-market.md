Analyze a Kalshi prediction market using the multi-agent research pipeline.

The user has provided a Kalshi market URL as the argument to this command.

**IMPORTANT:** Agent prompts are defined in `lib/prompts.ts`. Read that file first to understand the available prompt functions. Each stage below tells you which function to call and what arguments to pass. Interpolate the market data into the function arguments — the function returns the full prompt string.

## Step 1 — Fetch Market Data

Run the following command and parse the JSON output:
```
npx tsx -e "import { fetchMarket } from './lib/kalshi'; fetchMarket('TICKER').then(d => console.log(JSON.stringify(d, null, 2)))"
```
Replace TICKER with the ticker parsed from the user's URL (last path segment, uppercased).

If there is an error, stop and report it clearly.

Check the output for a `"type": "event"` field:
- If present → this is a **multi-outcome event**. The output contains a `markets` array of qualifying outcomes (yes_price >= 5%), and optionally a `sub_threshold_markets` array of active outcomes priced below 5%. Follow the **Event Flow** below.
- If absent → this is a **single binary market**. Follow the **Single Market Flow** below.

---

## Single Market Flow

### Step 2 — Run Evidence Agent (model: haiku)

Launch with the Task tool. Use the prompt from `lib/prompts.ts`:
- Function: `evidenceBinary(title, resolutionCriteria, closeDate, yesPrice)`

Wait for Evidence Agent to complete before proceeding.

### Step 3 — Extract Sources Pool

Parse the Evidence Agent output. Extract all lines from the `## SOURCES POOL` section — this is the accumulated research pool.

### Step 4 — Run Devil's Advocate (model: haiku)

Launch with the Task tool. Use the prompt from `lib/prompts.ts`:
- Function: `devilsAdvocateBinary(title, resolutionCriteria, closeDate, yesPrice, evidenceOutput, sourcesPool)`

Wait for Devil's Advocate to complete before proceeding.

### Step 5 — Merge Sources Pool

Append Devil's Advocate's `## ADDITIONAL SOURCES` to the sources pool.

### Step 6 — Run Resolution Agent and Chaos Agent in parallel

Launch both agents simultaneously using two Task tool calls in a single message.

**Resolution Agent (model: sonnet)** — prompt from `lib/prompts.ts`:
- Function: `resolutionBinary(title, resolutionCriteria, closeDate, evidenceOutput, devilsAdvocateOutput)`

**Chaos Agent (model: haiku)** — prompt from `lib/prompts.ts`:
- Function: `chaosBinary(title, resolutionCriteria, closeDate, yesPrice, evidenceOutput, devilsAdvocateOutput)`

### Step 7 — Run Calibrator (model: sonnet)

Use the prompt from `lib/prompts.ts`:
- Function: `calibratorBinary(title, resolutionCriteria, closeDate, yesPrice, volume, evidenceOutput, devilsAdvocateOutput, resolutionOutput, chaosOutput)`

### Step 8 — Save, Compare, and Display

**Check for prior analysis:** Before saving, search `results/` for any existing files matching `*_{TICKER}.md` (glob pattern). If a prior analysis exists:
- If it is from **today** (same YYYY-MM-DD in the filename): skip the delta — just save the new one alongside it.
- If it is from a **prior day**: read the prior file's Calibrator Report section and append a `## Delta Analysis` section to the NEW file (see format below).

**Save** the full results to `results/YYYY-MM-DD_HHMM_{TICKER}.md` (24-hour time, e.g. `2026-03-05_1430_KXSENATEILD-26.md`). Include all subagent outputs, accumulated sources pool, market snapshot, and timestamp.

**Delta Analysis format** (appended only when a prior-day analysis exists):
```
## Delta Analysis
**Previous analysis:** {prior_filename} ({prior_date})

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Market Price | X% | Y% | +/-Z pp |
| Estimated Prob | X% | Y% | +/-Z pp |
| Edge | X% | Y% | +/-Z pp |
| Confidence | low/med/high | low/med/high | — |

**What changed:**
- [Bullet each material change in the factual picture, new evidence, or shifted reasoning]
- [Note any new sources not in the prior analysis]
- [Flag if the direction of the edge flipped]

**Verdict:** [One sentence: is this a confirming update (same thesis, tighter), a reversing update (thesis changed), or a drift (small moves, no new info)?]
```

Display the Calibrator report (and Delta Analysis if present) to the user.

---

## Event Flow (multi-outcome markets)

Use this when the JSON output contains `"type": "event"` with a `markets` array. Format the qualifying outcomes as a numbered list:
```
N. {title} — market YES price: {price}
```

Also format sub-threshold markets the same way (or "None" if empty).

### Step 2 — Run Evidence Agent (model: haiku)

Launch with the Task tool. Use the prompt from `lib/prompts.ts`:
- Function: `evidenceEvent(title, closeDate, resolutionCriteria, outcomesText)`

Wait for Evidence Agent to complete.

### Step 3 — Extract Sources Pool

Parse the `## SOURCES POOL` section from Evidence Agent output.

### Step 4 — Run Devil's Advocate (model: haiku)

Use the prompt from `lib/prompts.ts`:
- Function: `devilsAdvocateEvent(title, closeDate, outcomesText, evidenceOutput, sourcesPool)`

Wait for Devil's Advocate to complete.

### Step 5 — Merge Sources Pool

Append Devil's Advocate's `## ADDITIONAL SOURCES` to the pool.

### Step 6 — Run Resolution Agent and Chaos Agent in parallel

Launch both agents simultaneously.

**Resolution Agent (model: sonnet)** — prompt from `lib/prompts.ts`:
- Function: `resolutionEvent(title, closeDate, resolutionCriteria, outcomesText, evidenceOutput, devilsAdvocateOutput)`

**Chaos Agent (model: haiku)** — prompt from `lib/prompts.ts`:
- Function: `chaosEvent(title, closeDate, outcomesText, subText, evidenceOutput, devilsAdvocateOutput)`

### Step 7 — Run Calibrator (model: sonnet)

Use the prompt from `lib/prompts.ts`:
- Function: `calibratorEvent(title, closeDate, outcomesText, subText, volume, evidenceOutput, devilsAdvocateOutput, resolutionOutput, chaosOutput)`

### Step 8 — Save, Compare, and Display

**Check for prior analysis:** Before saving, search `results/` for any existing files matching `*_{EVENT_TICKER}.md` (glob pattern). If a prior analysis exists:
- If it is from **today** (same YYYY-MM-DD in the filename): skip the delta — just save the new one alongside it.
- If it is from a **prior day**: read the prior file's Calibrator Report section and append a `## Delta Analysis` section to the NEW file (see format below).

**Save** the full results to `results/YYYY-MM-DD_HHMM_{EVENT_TICKER}.md` (24-hour time). Include all subagent outputs, accumulated sources pool, market snapshots, and timestamp.

**Delta Analysis format** (appended only when a prior-day analysis exists):
```
## Delta Analysis
**Previous analysis:** {prior_filename} ({prior_date})

| Outcome | Prev Price | Curr Price | Prev Est | Curr Est | Price Move | Estimate Move |
|---------|-----------|-----------|---------|---------|------------|---------------|
| {name}  | X%        | Y%        | X%      | Y%      | +/-Z pp    | +/-Z pp       |

**What changed:**
- [Bullet each material change in the factual picture, new evidence, or shifted reasoning]
- [Note any new sources not in the prior analysis]
- [Flag if the ranking of outcomes changed or any edge directions flipped]

**Verdict:** [One sentence: confirming update, reversing update, or drift?]
```

Display the Calibrator report (and Delta Analysis if present) to the user.