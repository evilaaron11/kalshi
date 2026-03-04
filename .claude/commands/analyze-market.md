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

### Step 2 — Generate Search Queries

From the market title and resolution criteria, generate 3–5 targeted news search queries.

### Step 3 — Fetch News

```
python news_fetcher.py "<query1>" "<query2>" "<query3>" ...
```

### Step 4 — Run Parallel Subagents

Launch all three simultaneously using the Task tool with `run_in_background: true`.

**Evidence Agent (model: haiku)**
```
You are a research analyst establishing the factual state of play for a prediction market.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT YES PRICE: {yes_price}

NEWS ARTICLES:
{articles}

Produce a concise bullet-point summary of:
- What has actually happened relevant to this market resolving YES or NO
- Events scheduled before the close date that could affect resolution
- What key actors have said or done publicly
- Any signals from related prediction markets if mentioned in sources

Factual only. No interpretation. Label each bullet with source and date.
```

**Devil's Advocate Agent (model: sonnet)**
```
You are a contrarian analyst. Argue against the consensus outcome for this prediction market.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT YES PRICE: {yes_price} (market's implied probability of YES)

NEWS ARTICLES:
{articles}

The market prices YES at {yes_price}. Make the strongest possible case the consensus is WRONG.

Produce a numbered list of counterarguments ranked strongest to weakest:
- Historical precedents where similar situations failed
- Wild cards or unexpected developments that could flip the outcome
- Weaknesses in the obvious thesis
- Timing risks before close date

Be specific. Cite sources where possible. Argue hard.
```

**Resolution Agent (model: sonnet)**
```
You are a specialist in prediction market resolution criteria.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}

NEWS ARTICLES:
{articles}

Analyze the exact resolution criteria:
1. Precise conditions for YES resolution
2. Precise conditions for NO resolution
3. Ambiguities in the wording
4. Edge cases — partial fulfillment, timing technicalities, definitional issues
5. Does anything in the news suggest a gotcha or unexpected resolution path?

Be precise. Flag anything that could cause the market to resolve differently than the surface reading.
```

**Chaos Agent (model: haiku)**
```
You are an analyst specializing in tail risks, black swan scenarios, and unpriced possibilities.

MARKET: {title}
RESOLUTION CRITERIA: {resolution_criteria}
CLOSE DATE: {close_date}
CURRENT YES PRICE: {yes_price}

NEWS ARTICLES:
{articles}

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

Be creative. Think about second-order effects, sudden reversals, key-person risks, institutional failures, and external shocks. Avoid scenarios already discussed in the news.
```

### Step 5 — Run Calibrator (model: opus)

```
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

NEWS ARTICLES:
{articles}

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

BETTING RECOMMENDATION ($100 BANKROLL):
[How you would allocate up to $100 across YES/NO positions on this market. You do not need to deploy all $100 — size to edge and confidence. For each position: state YES or NO, dollar amount, price paid, contracts purchased, and the specific thesis. Explain what you hold back and why. Account for tail risks that could wipe multiple positions simultaneously. Use half-Kelly sizing given medium confidence unless confidence is high.]

PROBABILITY METHODOLOGY:
[Explain exactly how you arrived at the estimated probability. Cover: (1) what base rate or anchor you started from, (2) which evidence pushed it up or down and by roughly how much, (3) how you weighted conflicting signals (e.g. bull vs bear case), (4) what you are most uncertain about in your own estimate, and (5) whether this is a judgment call, a base-rate adjustment, or something more quantitative. Be explicit enough that the reader can critique your reasoning and adjust the estimate themselves.]

Be honest about uncertainty. Do not round to clean numbers unless genuinely warranted.
```

### Step 6 — Save and Display

Display the Calibrator report. Save full results to `results/YYYY-MM-DD_{TICKER}.md` including all subagent outputs, market snapshot, articles, and timestamp.

---

## Event Flow (multi-outcome markets)

Use this when the JSON output contains `"type": "event"` with a `markets` array of qualifying outcomes with yes_price ≥ 5%. A `sub_threshold_markets` array may also be present with active outcomes priced below 5%.

Multi-outcome markets can represent many types of questions — who gets picked, when something happens, how many of something occurs, which scenario plays out, etc. Treat all qualifying markets as competing outcomes and reason about them comparatively.

### Step 2 — Generate Search Queries

From the event title and the titles of all qualifying markets, generate 4–6 search queries covering:
- The overall question being asked
- The leading outcomes specifically
- Recent news on the broader topic

### Step 3 — Fetch News

```
python news_fetcher.py "<query1>" "<query2>" ...
```

### Step 4 — Run Parallel Subagents

Launch all four simultaneously with `run_in_background: true`. Pass all qualifying markets and their prices so agents can reason comparatively across outcomes.

**Evidence Agent (model: haiku)**
```
You are a research analyst. Establish the factual state of play for a multi-outcome prediction market.

EVENT: {event_title}
CLOSE DATE: {close_date}
RESOLUTION CRITERIA: {resolution_criteria}

QUALIFYING OUTCOMES (yes_price ≥ 5%, sorted by probability):
{list all qualifying markets as: N. {title} — market YES price: {price}}

NEWS ARTICLES:
{articles}

For each outcome, summarize what the news says about its likelihood. Note any relevant facts, statements from key decision-makers, timelines, or context that bears on which outcome is most likely.

Also flag any outcomes below 5% that are getting significant news coverage.

Label every bullet with source and date. Factual only — no probability estimates.
```

**Devil's Advocate Agent (model: sonnet)**
```
You are a contrarian analyst challenging the market's ranking of outcomes.

EVENT: {event_title}
CLOSE DATE: {close_date}

QUALIFYING OUTCOMES (yes_price ≥ 5%, sorted by probability):
{list all qualifying markets as: N. {title} — market YES price: {price} [← market favorite, if #1]}

NEWS ARTICLES:
{articles}

Challenge the market consensus:
1. Is the market favorite actually as likely as priced? What could prevent it?
2. Are any lower-ranked outcomes underpriced? What evidence supports them?
3. Is there an outcome below 5% that deserves serious attention?
4. What historical precedents exist for the consensus being wrong in similar situations?

Argue hard. Be specific. Rank your counterarguments by strength.
```

**Resolution Agent (model: sonnet)**
```
You are a specialist in prediction market resolution criteria.

EVENT: {event_title}
CLOSE DATE: {close_date}
RESOLUTION CRITERIA: {resolution_criteria}

QUALIFYING OUTCOMES (yes_price ≥ 5%):
{list all qualifying markets as: N. {title} — {price}}

NEWS ARTICLES:
{articles}

Analyze:
1. Exact conditions for each outcome's market to resolve YES
2. Can more than one resolve YES simultaneously? Under what circumstances?
3. Ambiguities in the resolution wording that could cause unexpected results
4. Timing edge cases — what if the determining event happens after the close date?
5. Any gotchas in the resolution criteria based on current news?
```

**Chaos Agent (model: haiku)**
```
You are an analyst specializing in tail risks, black swan scenarios, and unpriced possibilities.

EVENT: {event_title}
CLOSE DATE: {close_date}

QUALIFYING OUTCOMES (yes_price ≥ 5%):
{list all qualifying markets as: N. {title} — {price}}

SUB-THRESHOLD OUTCOMES (yes_price < 5% — long shots currently below the analysis cutoff):
{list all sub_threshold_markets as: N. {title} — {price}, or "None" if sub_threshold_markets is absent or empty}

NEWS ARTICLES:
{articles}

Generate 3–5 specific, creative scenarios that meet ALL of these criteria:
- Highly unlikely individually (rough probability: 1–8% each)
- NOT currently reflected in market pricing
- Would materially shift outcome probabilities if they occurred
- Grounded in real-world plausibility — not pure fantasy

IMPORTANT: Consider ALL outcomes — including the sub-threshold long shots above. A sub-threshold outcome priced at 1–4% could be a seriously underpriced tail risk. Evaluate whether any of them represent scenarios the market is systematically ignoring.

For each scenario:
- Give it a short evocative name
- Describe it in 2–3 sentences
- Identify which outcome(s) it most affects and in which direction (can be a sub-threshold outcome)
- Assign a rough probability (be honest — these should be low)

Be creative. Think about second-order effects, sudden reversals, key-person risks, institutional failures, and external shocks. Avoid scenarios already discussed in the news.
```

### Step 5 — Run Calibrator (model: opus)

```
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

NEWS ARTICLES:
{articles}

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
[Any sub-threshold outcome (below 5%) — from sub_threshold_markets or raised by the chaos agent — worth monitoring. Include name, current price, and why it might be underpriced. If none, write "None identified."]

TAIL RISKS:
[1–2 chaos scenarios worth flagging, if any materially affect the distribution. Briefly note direction and rough probability. Otherwise: "None material."]

CONFIDENCE: low / medium / high
CRUX: [The single factor most likely to determine which outcome wins — one sentence]

RESOLUTION WATCH:
[Any technical flags on how these markets resolve]

KEY SOURCES:
- [title] — [source] ([age])

ANALYST NOTES:
[2–3 sentences of free-form commentary — biggest uncertainty, what to watch for]

BETTING RECOMMENDATION ($100 BANKROLL):
[How you would allocate up to $100 across YES/NO positions on these markets. You do not need to deploy all $100 — size to edge and confidence. For each position: state which market, YES or NO, dollar amount, price paid, and the specific thesis. Note correlations between outcomes (e.g. nested markets where winning one implies winning another). Explain what you hold back and why. Account for tail risks that could wipe multiple positions simultaneously. Use half-Kelly sizing given medium confidence unless confidence is high.]

PROBABILITY METHODOLOGY:
[For each outcome you estimated, explain exactly how you arrived at the number. Cover: (1) what base rate or anchor you started from, (2) which evidence pushed each estimate up or down and by roughly how much, (3) how you weighted conflicting signals across the panel (e.g. evidence vs devil's advocate), (4) what you are most uncertain about in your own estimates, and (5) whether this is a judgment call, a base-rate adjustment, or something more quantitative. Be explicit enough that the reader can critique your reasoning and adjust the estimates themselves.]

Do not round probabilities to clean numbers unless genuinely warranted. Be honest about uncertainty.
```

### Step 6 — Save and Display

Display the Calibrator report. Save full results to `results/YYYY-MM-DD_{EVENT_TICKER}.md` including all subagent outputs, market snapshots, articles, and timestamp.
