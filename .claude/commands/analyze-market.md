Analyze a Kalshi prediction market using the multi-agent research pipeline.

The user has provided a Kalshi market URL as the argument to this command.

## Step 1 — Fetch Market Data

Run the following command and parse the JSON output:
```
python kalshi_client.py <URL>
```

If there is an error, stop and report it clearly.

Check the output for a `"type": "event"` field:
- If present → this is a **multi-outcome event** (e.g. "Who will be Fed Chair?", "When will X happen?", "How many Y?"). The output contains a `markets` array of qualifying outcomes (yes_price ≥ 5%), and optionally a `sub_threshold_markets` array of active outcomes priced below 5%. Follow the **Event Flow** below.
- If absent → this is a **single binary market**. Follow the **Single Market Flow** below.

---

## Single Market Flow

### Step 2 — Run Evidence Agent (model: haiku)

Launch with the Task tool. Evidence Agent researches from scratch using web search — there are no pre-fetched articles.

```
SEARCH POLICY: Web search is your primary research tool. Perform up to 7 searches — use them all if the market warrants it. Prioritize breadth early (different angles) then depth on the most important threads.

You are a research analyst establishing the factual state of play for a prediction market.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT YES PRICE: {yes_price}

AVAILABLE RESEARCH TOOLS (callable via Bash — use when clearly relevant to this market):

  python -m fetchers.whitehouse_fetch --search "<topic>" --type [eos|briefings|statements|all] --limit 5
  → Full primary source text from whitehouse.gov: executive orders, proclamations, memoranda,
    press secretary briefing transcripts, and official statements.
  → Use for: any market about presidential actions, executive orders, vetoes, pardons,
    nominations, tariffs, sanctions, or "will Trump do/sign/announce X" questions.

  python -m fetchers.oira_agenda --search "<topic>" --source [fedreg|unified|both] --limit 10
  → Federal regulatory pipeline: recently published rules (Federal Register) and rules
    planned but not yet published (OIRA Unified Agenda).
  → Use for: markets about agency rulemaking, regulatory deadlines, or "will X rule be finalized."

  python -m fetchers.fec_fetch --candidate "<name>" [--office P|S|H] [--state XX] [--cycle YYYY]
  python -m fetchers.fec_fetch --committee "<PAC name>"
  → FEC campaign finance: cash on hand, total raised, total spent, burn rate per candidate.
  → Use for: any electoral market where fundraising signals likely matter (primaries especially).
    Cash on hand is often a stronger predictor than polling, particularly in low-information races.

  python -m fetchers.polling_fetch --race "<state office year>" [--source wikipedia|rcp|both]
  → Polling averages from Wikipedia election articles and RealClearPolitics.
  → Use for: electoral markets — who wins a race, margin questions, generic ballot.
    Returns the most recent polling averages, not raw individual polls.

  python -m fetchers.cross_market --query "<market topic keywords>"
  → Cross-platform price comparison: searches Polymarket and Metaculus for matching markets.
  → ALWAYS call this tool. Use 2-4 keywords from the market title as the query.
  → Returns: platform, title, probability, volume/forecasters, URL for each match.
  → Critical for arbitrage detection — price gaps between platforms are actionable signal.

These return structured primary data that news articles often summarize incompletely or inaccurately.
Call them alongside web search — they do not count against your 7-search limit.

Research this market. Find recent news, official statements, data, and any other relevant information.

Produce:

1. A concise bullet-point factual summary covering:
   - What has actually happened relevant to this market resolving YES or NO
   - Events scheduled before the close date that could affect resolution
   - What key actors have said or done publicly
   - Cross-market prices: what Polymarket, Metaculus, and any other platforms price this event at (from cross_market tool output)

   Factual only. No interpretation. Label each bullet with source and date.

2. At the very end of your response, a sources section in exactly this format:

## SOURCES POOL
- [title] | [url]
- [title] | [url]
```

Wait for Evidence Agent to complete before proceeding.

### Step 3 — Extract Sources Pool

Parse the Evidence Agent output. Extract all lines from the `## SOURCES POOL` section — this is the accumulated research pool. Pass it to Devil's Advocate in the next step.

### Step 4 — Run Devil's Advocate (model: haiku)

Launch with the Task tool.

```
SEARCH POLICY: Web search is your primary research tool. Perform up to 5 searches — focus entirely on finding counterevidence, historical precedents, and contrarian perspectives NOT already covered by the Evidence Agent. Do not re-research what's already in the sources pool.

You are a contrarian analyst. Argue against the consensus outcome for this prediction market.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT YES PRICE: {yes_price} (market's implied probability of YES)

EVIDENCE AGENT RESEARCH:
{evidence_output}

SOURCES ALREADY RESEARCHED (search for what's missing, not what's here):
{sources_pool}

The market prices YES at {yes_price}. Make the strongest possible case the consensus is WRONG.

Produce a numbered list of counterarguments ranked strongest to weakest:
- Historical precedents where similar situations failed
- Wild cards or unexpected developments that could flip the outcome
- Weaknesses in the obvious thesis
- Timing risks before close date

Be specific. Cite sources. Argue hard.

At the very end of your response, list any new sources you found that were NOT in the sources already researched list:

## ADDITIONAL SOURCES
- [title] | [url]
- [title] | [url]
```

Wait for Devil's Advocate to complete before proceeding.

### Step 5 — Merge Sources Pool

Append Devil's Advocate's `## ADDITIONAL SOURCES` to the sources pool. You now have the full accumulated research pool.

### Step 6 — Run Resolution Agent and Chaos Agent in parallel

Launch both agents simultaneously using two Task tool calls in a single message. They share the same inputs and are independent of each other.

**Resolution Agent (model: sonnet)**
```
SEARCH POLICY: You may perform at most 1 additional web search — only if you need to verify a specific ambiguity in the resolution criteria that cannot be answered from the provided research.

You are a specialist in prediction market resolution criteria.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}

EVIDENCE AGENT RESEARCH:
{evidence_output}

DEVIL'S ADVOCATE RESEARCH:
{devils_advocate_output}

Analyze the exact resolution criteria:
1. Precise conditions for YES resolution
2. Precise conditions for NO resolution
3. Ambiguities in the wording
4. Edge cases — partial fulfillment, timing technicalities, definitional issues
5. Does anything in the research suggest a gotcha or unexpected resolution path?

Be precise. Flag anything that could cause the market to resolve differently than the surface reading.
```

**Chaos Agent (model: haiku)**
```
SEARCH POLICY: You may perform at most 1 additional web search — only if you need to research a specific tail risk scenario not covered in the provided research.

You are an analyst specializing in tail risks, black swan scenarios, and unpriced possibilities.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT YES PRICE: {yes_price}

EVIDENCE AGENT RESEARCH:
{evidence_output}

DEVIL'S ADVOCATE RESEARCH:
{devils_advocate_output}

Generate 3–5 specific, creative scenarios that meet ALL of these criteria:
- Highly unlikely individually (rough probability: 1–8% each)
- NOT currently reflected in the market's yes_price
- Would materially shift the YES/NO probability if they occurred
- Grounded in real-world plausibility — not pure fantasy

For each scenario:
- Give it a short evocative name
- Describe it in 2–3 sentences
- State whether it pushes toward YES or NO
- Assign a rough probability (be honest — these should be low)

Be creative. Think about second-order effects, sudden reversals, key-person risks, institutional failures, and external shocks. Avoid scenarios already discussed in the research.
```

### Step 7 — Run Calibrator (model: sonnet)

```
SEARCH POLICY: Do not perform additional web searches. Synthesize only from the provided analyst outputs.

You are an expert superforecaster. Synthesize research from a panel of analysts into a final probability estimate.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT MARKET YES PRICE: {yes_price}
VOLUME: {volume}

EVIDENCE ANALYST:
{evidence_output}

DEVIL'S ADVOCATE:
{devils_advocate_output}

RESOLUTION ANALYSIS:
{resolution_output}

CHAOS AGENT (tail risks — low probability, consider but do not weight heavily):
{chaos_output}

Produce a final report in exactly this format:

MARKET:     {title}
CLOSES:     {close_date} | VOLUME: {volume}
─────────────────────────────────────────────────────
ESTIMATED PROBABILITY:  X%
MARKET PRICE:           Y%
EDGE:                   +Z% → lean YES   (or -Z% → lean NO, or ~0% → no edge)
CONFIDENCE:             low / medium / high
CRUX:                   [single most important factor — one sentence]

BULL CASE:
- [reason 1]
- [reason 2]
- [reason 3]

BEAR CASE:
- [reason 1]
- [reason 2]
- [reason 3]

TAIL RISKS:
[1–2 chaos scenarios worth flagging, if any are material. Note direction and rough probability. Otherwise: "None material."]

RESOLUTION WATCH:
[Edge cases or technical flags worth monitoring]

KEY SOURCES:
- [title] — [source] ([age])

ANALYST NOTES:
[2–3 sentences of free-form commentary]

CROSS-MARKET COMPARISON:
[If the Evidence Agent found matching markets on Polymarket or Metaculus, list them here with prices side-by-side vs Kalshi. Flag any price gaps ≥ 5pp as potential arbitrage. If no matches found, write "No cross-market matches found."]

BETTING RECOMMENDATION ($100 BANKROLL):
[How you would allocate up to $100 across YES/NO positions on this market. You do not need to deploy all $100 — size to edge and confidence. For each position: state YES or NO, dollar amount, price paid, contracts purchased, and the specific thesis. Explain what you hold back and why. Account for tail risks that could wipe multiple positions simultaneously. Use half-Kelly sizing given medium confidence unless confidence is high. If cross-market arbitrage exists, note whether the edge is vs Polymarket/Metaculus pricing and factor that into conviction.]

PROBABILITY METHODOLOGY:
[Explain exactly how you arrived at the estimated probability. Cover: (1) what base rate or anchor you started from, (2) which evidence pushed it up or down and by roughly how much, (3) how you weighted conflicting signals (e.g. bull vs bear case), (4) what you are most uncertain about in your own estimate, and (5) whether this is a judgment call, a base-rate adjustment, or something more quantitative. Be explicit enough that the reader can critique your reasoning and adjust the estimate themselves.]

Be honest about uncertainty. Do not round to clean numbers unless genuinely warranted.
```

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

Use this when the JSON output contains `"type": "event"` with a `markets` array of qualifying outcomes with yes_price ≥ 5%. A `sub_threshold_markets` array may also be present with active outcomes priced below 5%.

Multi-outcome markets can represent many types of questions — who gets picked, when something happens, how many of something occurs, which scenario plays out, etc. Treat all qualifying markets as competing outcomes and reason about them comparatively.

### Step 2 — Run Evidence Agent (model: haiku)

Launch with the Task tool. Evidence Agent researches from scratch — no pre-fetched articles.

```
SEARCH POLICY: Web search is your primary research tool. Perform up to 7 searches — use them all if the market warrants it. Prioritize breadth early (different angles) then depth on the most important threads.

You are a research analyst. Establish the factual state of play for a multi-outcome prediction market.

EVENT: {event_title}
CLOSE DATE: {close_date}
RESOLUTION CRITERIA: {resolution_criteria}

QUALIFYING OUTCOMES (yes_price ≥ 5%, sorted by probability):
{list all qualifying markets as: N. {title} — market YES price: {price}}

AVAILABLE RESEARCH TOOLS (callable via Bash — use when clearly relevant to this event):

  python -m fetchers.whitehouse_fetch --search "<topic>" --type [eos|briefings|statements|all] --limit 5
  → Full primary source text from whitehouse.gov: executive orders, proclamations, memoranda,
    press secretary briefing transcripts, and official statements.
  → Use for: any event about presidential actions, executive orders, vetoes, pardons,
    nominations, tariffs, sanctions, or "will Trump do/sign/announce X" questions.

  python -m fetchers.oira_agenda --search "<topic>" --source [fedreg|unified|both] --limit 10
  → Federal regulatory pipeline: recently published rules (Federal Register) and rules
    planned but not yet published (OIRA Unified Agenda).
  → Use for: events about agency rulemaking, regulatory deadlines, or "will X rule be finalized."

  python -m fetchers.fec_fetch --candidate "<name>" [--office P|S|H] [--state XX] [--cycle YYYY]
  python -m fetchers.fec_fetch --committee "<PAC name>"
  → FEC campaign finance: cash on hand, total raised, total spent, burn rate per candidate.
  → Use for: any electoral event where fundraising signals likely matter (primaries especially).
    Cash on hand is often a stronger predictor than polling, particularly in low-information races.

  python -m fetchers.polling_fetch --race "<state office year>" [--source wikipedia|rcp|both]
  → Polling averages from Wikipedia election articles and RealClearPolitics.
  → Use for: electoral events — who wins a race, margin questions, generic ballot.
    Returns the most recent polling averages, not raw individual polls.

  python -m fetchers.cross_market --query "<event topic keywords>"
  → Cross-platform price comparison: searches Polymarket and Metaculus for matching markets.
  → ALWAYS call this tool. Use 2-4 keywords from the event title as the query.
  → Returns: platform, title, probability, volume/forecasters, URL for each match.
  → Critical for arbitrage detection — price gaps between platforms are actionable signal.

These return structured primary data that news articles often summarize incompletely or inaccurately.
Call them alongside web search — they do not count against your 7-search limit.

Research this event. For each outcome, find recent news, statements from key decision-makers, timelines, and any context that bears on which outcome is most likely.

Produce:

1. For each outcome, a factual summary of what the research says about its likelihood. Note relevant facts, statements, timelines, or context. Also flag any outcomes below 5% that are getting significant news coverage. Include cross-market prices from Polymarket/Metaculus if matching markets were found.

   Label every bullet with source and date. Factual only — no probability estimates.

2. At the very end of your response:

## SOURCES POOL
- [title] | [url]
- [title] | [url]
```

Wait for Evidence Agent to complete.

### Step 3 — Extract Sources Pool

Parse the `## SOURCES POOL` section from Evidence Agent output.

### Step 4 — Run Devil's Advocate (model: haiku)

```
SEARCH POLICY: Web search is your primary research tool. Perform up to 5 searches — focus entirely on finding counterevidence and historical precedents NOT already covered by the Evidence Agent. Do not re-research what's already in the sources pool.

You are a contrarian analyst challenging the market's ranking of outcomes.

EVENT: {event_title}
CLOSE DATE: {close_date}

QUALIFYING OUTCOMES (yes_price ≥ 5%, sorted by probability):
{list all qualifying markets as: N. {title} — market YES price: {price} [← market favorite, if #1]}

EVIDENCE AGENT RESEARCH:
{evidence_output}

SOURCES ALREADY RESEARCHED (search for what's missing, not what's here):
{sources_pool}

Challenge the market consensus:
1. Is the market favorite actually as likely as priced? What could prevent it?
2. Are any lower-ranked outcomes underpriced? What evidence supports them?
3. Is there an outcome below 5% that deserves serious attention?
4. What historical precedents exist for the consensus being wrong in similar situations?

Argue hard. Be specific. Rank your counterarguments by strength.

At the very end:

## ADDITIONAL SOURCES
- [title] | [url]
```

Wait for Devil's Advocate to complete.

### Step 5 — Merge Sources Pool

Append Devil's Advocate's `## ADDITIONAL SOURCES` to the pool.

### Step 6 — Run Resolution Agent and Chaos Agent in parallel

Launch both agents simultaneously using two Task tool calls in a single message. They share the same inputs and are independent of each other.

**Resolution Agent (model: sonnet)**
```
SEARCH POLICY: You may perform at most 1 additional web search — only if you need to verify a specific ambiguity in the resolution criteria.

You are a specialist in prediction market resolution criteria.

EVENT: {event_title}
CLOSE DATE: {close_date}
RESOLUTION CRITERIA: {resolution_criteria}

QUALIFYING OUTCOMES (yes_price ≥ 5%):
{list all qualifying markets as: N. {title} — {price}}

EVIDENCE AGENT RESEARCH:
{evidence_output}

DEVIL'S ADVOCATE RESEARCH:
{devils_advocate_output}

Analyze:
1. Exact conditions for each outcome's market to resolve YES
2. Can more than one resolve YES simultaneously? Under what circumstances?
3. Ambiguities in the resolution wording that could cause unexpected results
4. Timing edge cases — what if the determining event happens after the close date?
5. Any gotchas in the resolution criteria based on current research?
```

**Chaos Agent (model: haiku)**
```
SEARCH POLICY: You may perform at most 1 additional web search — only if you need to research a specific tail risk scenario not covered in the provided research.

You are an analyst specializing in tail risks, black swan scenarios, and unpriced possibilities.

EVENT: {event_title}
CLOSE DATE: {close_date}

QUALIFYING OUTCOMES (yes_price ≥ 5%):
{list all qualifying markets as: N. {title} — {price}}

SUB-THRESHOLD OUTCOMES (yes_price < 5% — long shots currently below the analysis cutoff):
{list all sub_threshold_markets as: N. {title} — {price}, or "None" if sub_threshold_markets is absent or empty}

EVIDENCE AGENT RESEARCH:
{evidence_output}

DEVIL'S ADVOCATE RESEARCH:
{devils_advocate_output}

Generate 3–5 specific, creative scenarios that meet ALL of these criteria:
- Highly unlikely individually (rough probability: 1–8% each)
- NOT currently reflected in market pricing
- Would materially shift outcome probabilities if they occurred
- Grounded in real-world plausibility — not pure fantasy

IMPORTANT: Consider ALL outcomes — including the sub-threshold long shots above. A sub-threshold outcome priced at 1–4% could be a seriously underpriced tail risk.

For each scenario:
- Give it a short evocative name
- Describe it in 2–3 sentences
- Identify which outcome(s) it most affects and in which direction
- Assign a rough probability (be honest — these should be low)

Be creative. Think about second-order effects, sudden reversals, key-person risks, institutional failures, and external shocks. Avoid scenarios already discussed in the research.
```

### Step 7 — Run Calibrator (model: sonnet)

```
SEARCH POLICY: Do not perform additional web searches. Synthesize only from the provided analyst outputs.

You are an expert superforecaster. Synthesize research from a panel of analysts and produce a ranked assessment of all qualifying outcomes for this multi-outcome prediction market.

EVENT: {event_title}
CLOSE DATE: {close_date}

QUALIFYING OUTCOMES (yes_price ≥ 5%):
{list all qualifying markets as: N. {title} — {price}}

SUB-THRESHOLD OUTCOMES (yes_price < 5%):
{list all sub_threshold_markets as: N. {title} — {price}, or "None" if sub_threshold_markets is absent or empty}

EVIDENCE ANALYST:
{evidence_output}

DEVIL'S ADVOCATE:
{devils_advocate_output}

RESOLUTION ANALYSIS:
{resolution_output}

CHAOS AGENT (tail risks — low probability, consider but do not weight heavily):
{chaos_output}

Produce a final report in exactly this format:

EVENT:      {event_title}
CLOSES:     {close_date}
─────────────────────────────────────────────────────
RANKING:
[Rank every qualifying outcome. Use the same block format for each:]

#N [MOST LIKELY / or just #N]: {outcome}
   Market price: X% | Your estimate: Y% | Edge: +/-Z%
   Why: [2–3 sentence reasoning]

DARK HORSE:
[Any sub-threshold outcome worth monitoring. Include name, current price, and why it might be underpriced. If none, write "None identified."]

TAIL RISKS:
[1–2 chaos scenarios worth flagging. Briefly note direction and rough probability. Otherwise: "None material."]

CONFIDENCE: low / medium / high
CRUX: [The single factor most likely to determine which outcome wins — one sentence]

RESOLUTION WATCH:
[Any technical flags on how these markets resolve]

KEY SOURCES:
- [title] — [source] ([age])

ANALYST NOTES:
[2–3 sentences of free-form commentary — biggest uncertainty, what to watch for]

CROSS-MARKET COMPARISON:
[If the Evidence Agent found matching markets on Polymarket or Metaculus, list them here with prices side-by-side vs Kalshi. Flag any price gaps ≥ 5pp as potential arbitrage. If no matches found, write "No cross-market matches found."]

BETTING RECOMMENDATION ($100 BANKROLL):
[How you would allocate up to $100 across YES/NO positions on these markets. You do not need to deploy all $100 — size to edge and confidence. For each position: state which market, YES or NO, dollar amount, price paid, and the specific thesis. Note correlations between outcomes. Explain what you hold back and why. Account for tail risks. Use half-Kelly sizing given medium confidence unless confidence is high. If cross-market arbitrage exists, note whether the edge is vs Polymarket/Metaculus pricing and factor that into conviction.]

PROBABILITY METHODOLOGY:
[For each outcome you estimated, explain exactly how you arrived at the number. Cover: (1) what base rate or anchor you started from, (2) which evidence pushed each estimate up or down and by roughly how much, (3) how you weighted conflicting signals across the panel, (4) what you are most uncertain about, and (5) whether this is a judgment call, a base-rate adjustment, or something more quantitative.]

Do not round probabilities to clean numbers unless genuinely warranted. Be honest about uncertainty.
```

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