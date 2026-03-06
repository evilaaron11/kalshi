# Kalshi Analyst — UI Mockups

## 1. Dashboard — Market List

Shows all three card states: running analysis, idle, and completed.

```
┌──────────────────────────────────────────────────────────────────────┐
│  KALSHI ANALYST                                           [+ Add]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ BINARY · 🔄 ANALYZING                                         │  │
│  │ Gov Shutdown by March 15?                   YES 62¢   NO 38¢  │  │
│  │ Closes: Mar 15 · Vol: 42,891                                   │  │
│  │                                                                │  │
│  │  [✓ Fetch]─[✓ Evidence]─[● DA]─[○ Res ‖ Chaos]─[○ Calibrate] │  │
│  │   0:02      0:48         ░░░░▓▓▓                               │  │
│  │                                                                │  │
│  │  Latest: Devil's Advocate running search 2 of 5...             │  │
│  │  Evidence found 6 sources · 4 web searches · 1 fetcher call    │  │
│  │                                                      [Cancel]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ BINARY                                                         │  │
│  │ Fed Rate Cut in March?                       YES  8¢   NO 92¢ │  │
│  │ Closes: Mar 19 · Vol: 18,204                                   │  │
│  │                                                     [Analyze ▶]│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ BINARY                                                         │  │
│  │ Trump Tariffs on EU by April?                YES 41¢   NO 59¢ │  │
│  │ Closes: Apr 1 · Vol: 31,550                                    │  │
│  │                                                     [Analyze ▶]│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ BINARY · ✓ COMPLETE · Mar 4, 2:14 PM · 3m 42s                 │  │
│  │ TikTok Ban Enforced?                         YES 23¢   NO 77¢ │  │
│  │ Closes: Apr 5 · Vol: 55,102                                    │  │
│  │                                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐               │  │
│  │  │ Est: 28% │  │ Mkt: 23% │  │ Edge: +5% YES  │               │  │
│  │  └──────────┘  └──────────┘  └────────────────┘               │  │
│  │  Confidence: Medium                                            │  │
│  │  Crux: DOJ enforcement timeline depends on appeal ruling       │  │
│  │                                                                │  │
│  │  Bet: BUY YES $12 @ 23¢ (52 contracts)                        │  │
│  │                                                                │  │
│  │                              [View Full Report]  [Re-run ▶]   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dashboard — Event (Multi-Outcome) Cards

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ EVENT · 6 outcomes                                             │  │
│  │ Who wins the 2028 Dem presidential primary?                    │  │
│  │ Closes: Aug 15 · Vol: 128,440                                  │  │
│  │                                                                │  │
│  │  Shapiro      ████████████████████░░░░░░░░░░░░░░░░░░░░  28¢   │  │
│  │  Whitmer      ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  19¢   │  │
│  │  Newsom       ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  16¢   │  │
│  │  Buttigieg    ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11¢   │  │
│  │  Pritzker     ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   8¢   │  │
│  │  +4 more under 5¢                                              │  │
│  │                                                     [Analyze ▶]│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ EVENT · 4 outcomes · 🔄 ANALYZING                              │  │
│  │ When will the next Fed rate cut happen?                         │  │
│  │ Closes: Dec 31 · Vol: 74,200                                   │  │
│  │                                                                │  │
│  │  June         ████████████████████████░░░░░░░░░░░░░░░░  34¢   │  │
│  │  September    ██████████████████░░░░░░░░░░░░░░░░░░░░░░  24¢   │  │
│  │  December+    █████████████████░░░░░░░░░░░░░░░░░░░░░░░  22¢   │  │
│  │  March        ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12¢   │  │
│  │                                                                │  │
│  │  [✓ Fetch]─[✓ Evidence]─[● DA]─[○ Res ‖ Chaos]─[○ Calibrate] │  │
│  │  Latest: DA searching for contrarian case on June cut...       │  │
│  │                                                      [Cancel]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ EVENT · 4 outcomes · ✓ COMPLETE · Mar 4, 1:52 PM · 4m 18s     │  │
│  │ Who will be next Supreme Court nominee?                        │  │
│  │ Closes: Jun 30 · Vol: 91,305                                   │  │
│  │                                                                │  │
│  │           Market    Est    Edge                                 │  │
│  │  Hardiman   31¢     38%   +7% ▲                                │  │
│  │  Ho         22¢     20%   -2%                                  │  │
│  │  Thapar     18¢     18%   ~0%                                  │  │
│  │  Oldham     14¢     18%   +4% ▲                                │  │
│  │                                                                │  │
│  │  Confidence: Medium                                            │  │
│  │  Crux: Trump inner circle leaning Hardiman but FedSoc          │  │
│  │  pushing Ho                                                    │  │
│  │                                                                │  │
│  │  Bet: BUY Hardiman YES $18 @ 31¢ · BUY Oldham YES $8 @ 14¢   │  │
│  │                                                                │  │
│  │                              [View Full Report]  [Re-run ▶]   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Full Report — Binary Market

Reached by clicking "View Full Report" on a completed binary card.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Markets                                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Gov Shutdown by March 15?                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌───────────────────┐    │
│  │  ESTIMATE         │ │  MARKET          │ │  EDGE             │    │
│  │      68%          │ │      62%         │ │   +6% → YES       │    │
│  └──────────────────┘ └──────────────────┘ └───────────────────┘    │
│  Confidence: Medium  ·  Closes: Mar 15  ·  Vol: 42,891              │
│  Run: Mar 5, 2026 2:14 PM  ·  Pipeline: 3m 42s                      │
│                                                                      │
│  CRUX                                                                │
│  CR expires Mar 14 with no deal framework; House Freedom Caucus      │
│  blocking standalone extension                                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  BULL CASE                                    BEAR CASE         │ │
│  │                                                                 │ │
│  │  • House GOP lacks votes for      • Senate bipartisan group     │ │
│  │    clean CR; 3 factions with        has draft CR text ready     │ │
│  │    incompatible demands           • Trump may sign short-term   │ │
│  │  • No committee markup              extension to avoid blame    │ │
│  │    scheduled as of Mar 5          • McConnell publicly pushing  │ │
│  │  • Trump said "let it shut          for deal; 8 GOP senators    │ │
│  │    down" at rally Mar 2             on record supporting CR     │ │
│  │  • OMB already sent lapse         • Markets have priced in      │ │
│  │    contingency memos to             brinkmanship before —       │ │
│  │    agencies                         2024 resolved at 11th hour  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  TAIL RISKS                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  "The DOGE Wrench" — Musk announces DOGE will release agency   │ │
│  │  efficiency report Mar 13, creating new demands that blow up    │ │
│  │  any emerging deal. → pushes YES. ~4%                           │ │
│  │                                                                 │ │
│  │  "Midnight Discharge Petition" — 5+ House GOP defectors join   │ │
│  │  Democrats on discharge petition for clean CR, bypassing        │ │
│  │  Speaker. → pushes NO. ~3%                                      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  RESOLUTION WATCH                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • Market resolves on funding lapse, NOT on political           │ │
│  │    announcement — a signed CR at 11:59 PM Mar 14 = NO           │ │
│  │  • Partial shutdown (some agencies funded) still resolves YES   │ │
│  │  • Watch for: "skinny CR" that funds only DHS — this counts     │ │
│  │    as avoiding shutdown per resolution criteria                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  BETTING RECOMMENDATION                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  BUY YES   $15 @ 62¢   →  24 contracts                         │ │
│  │  Thesis: 6% edge at medium confidence → half-Kelly sizing       │ │
│  │  Hold back: $85 — moderate edge, shutdown timing uncertain,     │ │
│  │  "skinny CR" tail risk could flip outcome                       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  METHODOLOGY                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Base rate: 55% anchor from historical CR expirations without   │ │
│  │  a deal framework 10 days out (3 of 5 since 2018 lapsed).      │ │
│  │  Adjusted +8% for Trump's public rhetoric and Freedom Caucus   │ │
│  │  hard line. Adjusted +2% for OMB lapse memos (signals WH is    │ │
│  │  not trying to prevent). Adjusted -2% for Senate bipartisan    │ │
│  │  draft. Net: ~63%, rounded to 68% after weighting devil's      │ │
│  │  advocate finding that McConnell coalition is larger than       │ │
│  │  typical. Most uncertain about: whether Trump reverses          │ │
│  │  rhetoric in final 48 hours (has done so twice in 2025).        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ──── Agent Outputs ────                                             │
│                                                                      │
│  ▸ Evidence Agent            (click to expand)                       │
│  ▸ Devil's Advocate          (click to expand)                       │
│  ▸ Resolution Analysis       (click to expand)                       │
│  ▸ Chaos Agent               (click to expand)                       │
│                                                                      │
│  SOURCES (12)                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • House GOP CR whip count — Punchbowl News (Mar 4)             │ │
│  │  • Trump rally transcript — whitehouse.gov (Mar 2)              │ │
│  │  • Senate bipartisan framework — Politico (Mar 3)               │ │
│  │  • OMB lapse planning memo — Washington Post (Mar 5)            │ │
│  │  • ...8 more                                                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│                                                          [Re-run ▶] │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Full Report — Event (Multi-Outcome) Market

Reached by clicking "View Full Report" on a completed event card.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Markets                                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Who will be next Supreme Court nominee?                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Confidence: Medium  ·  Closes: Jun 30  ·  Vol: 91,305              │
│  Run: Mar 4, 2026 1:52 PM  ·  Pipeline: 4m 18s                      │
│                                                                      │
│  CRUX                                                                │
│  Trump inner circle leaning Hardiman but Federalist Society          │
│  pushing Ho; decision likely weeks away, not days                    │
│                                                                      │
│  OUTCOME RANKING                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │  #1 MOST LIKELY                                                 │ │
│  │  Thomas Hardiman                                                │ │
│  │  Market: 31¢  │  Estimate: 38%  │  Edge: +7% ▲                 │ │
│  │  ████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░  │ │
│  │  Why: Only candidate with prior Trump shortlist history (2017   │ │
│  │  finalist). Three WH sources confirm he's in the "top two."    │ │
│  │  Strong 3rd Circuit record aligns with admin priorities.        │ │
│  │                                                                 │ │
│  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │
│  │                                                                 │ │
│  │  #2                                                             │ │
│  │  James Ho                                                       │ │
│  │  Market: 22¢  │  Estimate: 20%  │  Edge: -2%                   │ │
│  │  ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  Why: Federalist Society's top pick. Strong originalist         │ │
│  │  credentials. But limited personal relationship with Trump,     │ │
│  │  which historically matters more than ideology.                 │ │
│  │                                                                 │ │
│  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │
│  │                                                                 │ │
│  │  #3                                                             │ │
│  │  Amul Thapar                                                    │ │
│  │  Market: 18¢  │  Estimate: 18%  │  Edge: ~0%                   │ │
│  │  ██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  Why: Would be first Asian-American justice. Trump values       │ │
│  │  "firsts" for legacy. But less vocal conservative media         │ │
│  │  support than top two.                                          │ │
│  │                                                                 │ │
│  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │
│  │                                                                 │ │
│  │  #4                                                             │ │
│  │  Andrew Oldham                                                  │ │
│  │  Market: 14¢  │  Estimate: 18%  │  Edge: +4% ▲                 │ │
│  │  ██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  Why: Texas connections, Cruz ally. Youngest candidate at 46.   │ │
│  │  Dark horse gaining momentum — 2 recent Axios reports cite      │ │
│  │  him as "rising on the list." Underpriced relative to signal.   │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  DARK HORSE                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Lisa Branch — currently 3¢                                     │ │
│  │  11th Circuit judge with strong Kemp/Georgia GOP backing.       │ │
│  │  If Trump wants a woman for optics, she's the most likely       │ │
│  │  pick outside the top tier. Worth monitoring.                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  TAIL RISKS                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  "The Loyalty Test" — Trump nominates a non-judge personal      │ │
│  │  loyalist (e.g. someone from his legal defense team), breaking  │ │
│  │  from Federalist Society pipeline entirely. → all current       │ │
│  │  favorites drop. ~2%                                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  RESOLUTION WATCH                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • Resolves on formal nomination announcement, not              │ │
│  │    confirmation vote                                            │ │
│  │  • If nominee withdraws and new nominee named before close,     │ │
│  │    the FINAL nominee is used                                    │ │
│  │  • "No nomination by close date" is not an outcome — market     │ │
│  │    would extend or void per Kalshi rules                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  BETTING RECOMMENDATION                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  BUY Hardiman YES    $18 @ 31¢  →  58 contracts                │ │
│  │  Thesis: Strongest edge, most evidence, Trump shortlist         │ │
│  │                                                                 │ │
│  │  BUY Oldham YES      $8 @ 14¢   →  57 contracts                │ │
│  │  Thesis: Underpriced momentum play; hedge against Hardiman      │ │
│  │                                                                 │ │
│  │  Hold back: $74 — high uncertainty, decision may be months      │ │
│  │  away, positions correlated (both lose if Ho picked)            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  METHODOLOGY                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Anchored on base rate: Trump SCOTUS picks have always come     │ │
│  │  from Federalist Society shortlist (3/3). Within that pool,     │ │
│  │  weighted 40% on WH source reporting, 30% on personal          │ │
│  │  relationship signals, 20% on Federalist Society preference,    │ │
│  │  10% on media momentum. Hardiman's prior shortlist appearance   │ │
│  │  is unique signal — no other candidate has it. Most uncertain   │ │
│  │  about: timeline. If decision is 3+ months away, current        │ │
│  │  signals decay significantly.                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ──── Agent Outputs ────                                             │
│  ▸ Evidence Agent            (click to expand)                       │
│  ▸ Devil's Advocate          (click to expand)                       │
│  ▸ Resolution Analysis       (click to expand)                       │
│  ▸ Chaos Agent               (click to expand)                       │
│                                                                      │
│  SOURCES (15)                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • WH insider shortlist report — Axios (Mar 2)                  │ │
│  │  • Federalist Society rankings — National Review (Feb 28)       │ │
│  │  • Oldham momentum piece — Axios (Mar 3)                        │ │
│  │  • Trump SCOTUS history analysis — SCOTUSblog (Mar 1)           │ │
│  │  • ...11 more                                                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│                                                          [Re-run ▶] │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Add Market Modal

Triggered by `[+ Add]` button in header.

```
┌──────────────────────────────────────────────────────┐
│  Add Market                                     [×]  │
│                                                      │
│  Paste a Kalshi market or event URL:                 │
│  ┌──────────────────────────────────────────────┐    │
│  │ https://kalshi.com/markets/shutdown-mar15     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Type auto-detected from URL.                        │
│                                                      │
│                          [Cancel]  [Add to Watchlist] │
└──────────────────────────────────────────────────────┘
```

---

## 6. Progress Stepper — Detailed States

```
Binary pipeline:
[✓ Fetch]──[✓ Evidence]──[● DA]──[○ Res ‖ Chaos]──[○ Calibrate]
  0:02       0:48         ░▓▓▓

Legend:
  ✓  = completed (green)
  ●  = in progress (blue, pulsing)
  ○  = pending (gray)
  ‖  = parallel execution (both run simultaneously)

Time shown under completed steps.
Progress bar under active step.
```
