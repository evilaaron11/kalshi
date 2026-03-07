Analyze a Kalshi prediction market using the multi-agent research pipeline.

The user has provided a Kalshi market URL as the argument to this command.

**IMPORTANT:** Agent prompts are defined in `src/prompts.py`. Read that file first to understand the available prompt functions. Each stage below tells you which function to call and what arguments to pass. Interpolate the market data into the function arguments — the function returns the full prompt string.

## Step 1 — Fetch Market Data

Run the following command and parse the JSON output:
```
python kalshi_client.py <URL>
```

If there is an error, stop and report it clearly.

Check the output for a `"type": "event"` field:
- If present → this is a **multi-outcome event**. The output contains a `markets` array of qualifying outcomes (yes_price >= 5%), and optionally a `sub_threshold_markets` array of active outcomes priced below 5%. Follow the **Event Flow** below.
- If absent → this is a **single binary market**. Follow the **Single Market Flow** below.

---

## Single Market Flow

### Step 2 — Run Evidence Agent (model: haiku)

Launch with the Task tool. Use the prompt from `src/prompts.py`:
- Function: `evidence_binary(title, resolution_criteria, close_date, yes_price)`

Wait for Evidence Agent to complete before proceeding.

### Step 3 — Extract Sources Pool

Parse the Evidence Agent output. Extract all lines from the `## SOURCES POOL` section — this is the accumulated research pool.

### Step 4 — Run Devil's Advocate (model: haiku)

Launch with the Task tool. Use the prompt from `src/prompts.py`:
- Function: `devils_advocate_binary(title, resolution_criteria, close_date, yes_price, evidence_output, sources_pool)`

Wait for Devil's Advocate to complete before proceeding.

### Step 5 — Merge Sources Pool

Append Devil's Advocate's `## ADDITIONAL SOURCES` to the sources pool.

### Step 6 — Run Resolution Agent and Chaos Agent in parallel

Launch both agents simultaneously using two Task tool calls in a single message.

**Resolution Agent (model: sonnet)** — prompt from `src/prompts.py`:
- Function: `resolution_binary(title, resolution_criteria, close_date, evidence_output, devils_advocate_output)`

**Chaos Agent (model: haiku)** — prompt from `src/prompts.py`:
- Function: `chaos_binary(title, resolution_criteria, close_date, yes_price, evidence_output, devils_advocate_output)`

### Step 7 — Run Calibrator (model: sonnet)

Use the prompt from `src/prompts.py`:
- Function: `calibrator_binary(title, resolution_criteria, close_date, yes_price, volume, evidence_output, devils_advocate_output, resolution_output, chaos_output)`

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

Launch with the Task tool. Use the prompt from `src/prompts.py`:
- Function: `evidence_event(title, close_date, resolution_criteria, outcomes_text)`

Wait for Evidence Agent to complete.

### Step 3 — Extract Sources Pool

Parse the `## SOURCES POOL` section from Evidence Agent output.

### Step 4 — Run Devil's Advocate (model: haiku)

Use the prompt from `src/prompts.py`:
- Function: `devils_advocate_event(title, close_date, outcomes_text, evidence_output, sources_pool)`

Wait for Devil's Advocate to complete.

### Step 5 — Merge Sources Pool

Append Devil's Advocate's `## ADDITIONAL SOURCES` to the pool.

### Step 6 — Run Resolution Agent and Chaos Agent in parallel

Launch both agents simultaneously.

**Resolution Agent (model: sonnet)** — prompt from `src/prompts.py`:
- Function: `resolution_event(title, close_date, resolution_criteria, outcomes_text, evidence_output, devils_advocate_output)`

**Chaos Agent (model: haiku)** — prompt from `src/prompts.py`:
- Function: `chaos_event(title, close_date, outcomes_text, sub_text, evidence_output, devils_advocate_output)`

### Step 7 — Run Calibrator (model: sonnet)

Use the prompt from `src/prompts.py`:
- Function: `calibrator_event(title, close_date, outcomes_text, sub_text, volume, evidence_output, devils_advocate_output, resolution_output, chaos_output)`

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