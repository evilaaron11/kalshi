import { describe, it, expect } from "vitest";
import { parseReport, parseBets } from "../lib/reportParser";

const SAMPLE_BINARY_REPORT = `# Analysis: Will there be a government shutdown?
Generated: 2026-03-18T15:00:00Z
Ticker: KXGOV-SHUTDOWN

## Calibrator Report
MARKET:     Will there be a government shutdown?
CLOSES:     Apr 1, 2026 | VOLUME: 12345
---
ESTIMATED PROBABILITY:  72%
MARKET PRICE:           65%
EDGE:                   +7% -> lean YES
CONFIDENCE:             medium
CRUX:                   Congressional negotiations have stalled with no CR in sight

BULL CASE:
- No continuing resolution has been introduced yet
- Both parties are dug in on spending levels
- Clock is running out with only 14 days left

BEAR CASE:
- Historical precedent shows last-minute deals
- Leadership has signaled willingness to negotiate
- Short-term CR remains possible

TAIL RISKS:
Emergency presidential action or discharge petition could bypass normal process, but probability is low (~3%).

RESOLUTION WATCH:
Watch for any CR or omnibus bill text being released. Market resolves on midnight lapse, not on bill signing.

KEY SOURCES:
- Congressional Budget Office analysis — https://cbo.gov/shutdown-2026
- Reuters: Shutdown talks stall — https://reuters.com/politics/shutdown

ANALYST NOTES:
The market appears slightly underpriced given the negotiation timeline. The 7pp edge is within the medium-confidence range.

CROSS-MARKET COMPARISON:
Polymarket prices this at 70%, Metaculus at 74%. Kalshi's 65% is the lowest, suggesting a small arbitrage opportunity.

BETTING RECOMMENDATION ($100 BANKROLL):
Buy YES at 65c, $30 position (46 contracts). Half-Kelly sizing given medium confidence.

PROBABILITY METHODOLOGY:
Base rate of government shutdowns when CR expires: ~40%. Adjusted upward to 72% due to current political dynamics and timeline pressure.

## Evidence Agent
Evidence gathered from 7 web searches. Key findings include congressional deadlock and no CR text introduced.

## FACTUAL SUMMARY

**Budget Status**
- No continuing resolution introduced as of March 2026 (Source: CBO, 2026-03-15)
- Both chambers remain in session through deadline (Source: Congress.gov)

## SOURCES POOL
- [CBO Budget Analysis](https://cbo.gov/report)
- [Reuters: Shutdown talks stall](https://reuters.com/politics/shutdown-2026)
- [Congressional Budget Office](https://cbo.gov/shutdown-analysis)

## Devil's Advocate

## COUNTERARGUMENTS

Counter-arguments: historical precedent strongly favors last-minute deals (80% of shutdown threats resolve).

## ADDITIONAL SOURCES
- [Historical shutdown data](https://history.gov/shutdowns)

## Resolution Analysis
Resolution is clear: lapse in appropriations at midnight. No ambiguity in criteria.

## Chaos Agent
Scenarios:
1. "Presidential Emergency" - executive action bypasses Congress (2% probability)
2. "Discharge Petition Surprise" - moderate coalition forces vote (4% probability)

## Tail Risk Details
More details about each scenario and their potential impacts.
`;

const SAMPLE_EVENT_REPORT = `# Analysis: Who will be the next Fed Chair?
Generated: 2026-03-18T15:00:00Z
Ticker: KXFEDCHAIR

## Calibrator Report
EVENT:      Who will be the next Fed Chair?
CLOSES:     Jun 1, 2026
---
RANKING:
#1 MOST LIKELY: Kevin Warsh
   Market price: 45% | Your estimate: 50% | Edge: +5%
   Why: Strong political backing and public statements from administration officials

#2: Jerome Powell (reappointment)
   Market price: 30% | Your estimate: 25% | Edge: -5%
   Why: Incumbent advantage but political headwinds

#3: Kevin Hassett
   Market price: 15% | Your estimate: 15% | Edge: ~0%
   Why: Dark horse with inside connections

DARK HORSE:
Neel Kashkari has been mentioned in passing but has no real momentum.

TAIL RISKS:
Surprise nomination of a non-traditional candidate could scramble all probabilities.

CONFIDENCE: medium
CRUX: White House signaling strongly favors Warsh but no official announcement yet

RESOLUTION WATCH:
Resolves to whoever is nominated AND confirmed. If no confirmation by close, resolves to "Other."

KEY SOURCES:
- WSJ: Warsh frontrunner — https://wsj.com/fedchair
- Bloomberg: Powell may stay — https://bloomberg.com/fed

ANALYST NOTES:
Market is broadly efficient. Small edge on Warsh based on leaked transition documents.

CROSS-MARKET COMPARISON:
Polymarket: Warsh 48%, Powell 28%. Metaculus: Warsh 52%.

BETTING RECOMMENDATION ($100 BANKROLL):
Buy Warsh YES at 45c, $20 position.

PROBABILITY METHODOLOGY:
Base rate anchored on historical nomination patterns, adjusted for current political signals.

## Evidence Agent
Research found strong signals for Warsh nomination.

## Devil's Advocate
Powell reappointment cannot be ruled out given precedent.

## Resolution Analysis
Clear resolution criteria tied to Senate confirmation.

## Chaos Agent
Wild scenario: emergency Fed restructuring bill changes the rules entirely.
`;

describe("parseReport — binary", () => {
  const report = parseReport(SAMPLE_BINARY_REPORT);

  it("parses header fields", () => {
    expect(report.title).toBe("Will there be a government shutdown?");
    expect(report.ticker).toBe("KXGOV-SHUTDOWN");
    expect(report.generatedAt).toBe("2026-03-18T15:00:00Z");
  });

  it("parses probability and edge", () => {
    expect(report.estimatedProbability).toBe("72%");
    expect(report.marketPrice).toBe("65%");
    expect(report.edge).toContain("+7%");
    expect(report.edgeDirection).toBe("yes");
  });

  it("parses confidence and crux", () => {
    expect(report.confidence).toBe("medium");
    expect(report.crux).toContain("Congressional negotiations");
  });

  it("parses bull and bear cases", () => {
    expect(report.bullCase.length).toBeGreaterThanOrEqual(2);
    expect(report.bearCase.length).toBeGreaterThanOrEqual(2);
    expect(report.bullCase[0]).toContain("continuing resolution");
  });

  it("parses key sources with merged URLs from evidence pool", () => {
    // KEY SOURCES in calibrator have URLs, plus SOURCES POOL from evidence agent
    expect(report.keySources.length).toBeGreaterThanOrEqual(2);
    // Should have clickable URLs from either KEY SOURCES or SOURCES POOL
    const withUrls = report.keySources.filter((s) => s.url);
    expect(withUrls.length).toBeGreaterThan(0);
  });

  it("parses tail risks", () => {
    expect(report.tailRisks).toContain("Emergency presidential");
  });

  it("parses full sub-agent sections including sub-headers", () => {
    // Evidence agent should include sub-headers like ## FACTUAL SUMMARY and ## SOURCES POOL
    expect(report.evidenceAgent).toContain("7 web searches");
    expect(report.evidenceAgent).toContain("FACTUAL SUMMARY");
    expect(report.evidenceAgent).toContain("SOURCES POOL");
    expect(report.evidenceAgent).toContain("cbo.gov");

    // Devil's Advocate should include ## COUNTERARGUMENTS sub-header
    expect(report.devilsAdvocate).toContain("historical precedent");
    expect(report.devilsAdvocate).toContain("COUNTERARGUMENTS");

    expect(report.resolutionAnalysis).toContain("lapse in appropriations");

    // Chaos agent should include ## Tail Risk Details sub-header
    expect(report.chaosAgent).toContain("Discharge Petition");
    expect(report.chaosAgent).toContain("Tail Risk Details");
  });

  it("has no rankings (binary market)", () => {
    expect(report.rankings.length).toBe(0);
  });

  it("parses betting recommendation", () => {
    expect(report.bettingRecommendation).toContain("Buy YES");
  });

  it("parses cross-market comparison", () => {
    expect(report.crossMarket).toContain("Polymarket");
  });
});

describe("parseReport — event", () => {
  const report = parseReport(SAMPLE_EVENT_REPORT);

  it("parses rankings", () => {
    expect(report.rankings.length).toBeGreaterThanOrEqual(2);
    expect(report.rankings[0].outcome).toContain("Warsh");
    expect(report.rankings[0].rank).toBe(1);
  });

  it("parses dark horse", () => {
    expect(report.darkHorse).toContain("Kashkari");
  });

  it("has no binary probability fields", () => {
    // Event reports use RANKING instead
    expect(report.estimatedProbability).toBeNull();
  });
});

describe("parseReport — real format sections", () => {
  const realTailRisks = `## Calibrator Report
TAIL RISKS:
1. **Stratospheric Aerosol Injection (SAI) deployment** (~2% probability): If wealthy nations deploy SAI by 2038–2042 to cap warming at 1.5–1.8°C, annual anomalies could be artificially suppressed below 2°C indefinitely.
2. **Amazon tipping point + carbon feedback pulse** (~3% probability): Accelerated deforestation triggers Amazon savannification by 2035–2038, releasing a 50–100 GtCO₂ pulse.

RESOLUTION WATCH:
- **Critical ambiguity — "Source Agencies" undefined**: The contract never enumerates which agencies qualify.
- **2049 report timing trap**: Year-2049 annual temperature reports won't publish until mid-January 2050.

CROSS-MARKET COMPARISON:
No cross-market matches found.

BETTING RECOMMENDATION ($100 BANKROLL):
**NO — $6 at 21 cents per contract (~29 contracts)**
- True p(NO) ≈ 31% vs. market-implied p(NO) = 21%
- Thesis: Inter-dataset divergence structurally raises the functional threshold

PROBABILITY METHODOLOGY:
Base rate anchor`;

  const report = parseReport(realTailRisks);

  it("parses tail risks with bold labels", () => {
    expect(report.tailRisks).toContain("**Stratospheric Aerosol");
    expect(report.tailRisks).toContain("**Amazon tipping point");
  });

  it("parses resolution watch bullets", () => {
    expect(report.resolutionWatch).toContain("**Critical ambiguity");
    expect(report.resolutionWatch).toContain("**2049 report timing");
  });

  it("parses cross-market even when no matches", () => {
    expect(report.crossMarket).toContain("No cross-market matches");
  });

  it("parses betting recommendation with parenthetical bankroll label", () => {
    expect(report.bettingRecommendation).toContain("NO");
    expect(report.bettingRecommendation).toContain("21 cents");
  });
});

describe("parseReport — grouped rankings", () => {
  const reportWithGrouped = `## Calibrator Report
RANKING:
#1 MOST LIKELY: Alice
   Market price: 50% | Your estimate: 60% | Edge: +10%
   Why: Strong signals

#2: Bob
   Market price: 30% | Your estimate: 20% | Edge: -10%
   Why: Weak signals

#3-#6 (remaining outcomes — Charlie, Diana, Eve, Frank):
   Market prices: 10–15% | Estimated range: 8–12% | Edges: -2% to -5%
   Why: No specific signals

DARK HORSE:
None.

## Evidence Agent
Done.
## Devil's Advocate
Done.
## Resolution Analysis
Done.
## Chaos Agent
Done.`;

  const report = parseReport(reportWithGrouped);

  it("expands grouped range into individual entries", () => {
    expect(report.rankings.length).toBe(6); // 1 + 1 + 4 expanded
  });

  it("preserves individual ranking fields", () => {
    const alice = report.rankings.find((r) => r.outcome === "Alice");
    expect(alice?.edge).toContain("+10%");
    expect(alice?.marketPrice).toBe("50%");
  });

  it("expands named entries from grouped range", () => {
    const charlie = report.rankings.find((r) => r.outcome === "Charlie");
    expect(charlie).toBeDefined();
    expect(charlie?.rank).toBe(3);

    const frank = report.rankings.find((r) => r.outcome === "Frank");
    expect(frank).toBeDefined();
    expect(frank?.rank).toBe(6);
  });

  it("marks grouped entries", () => {
    const charlie = report.rankings.find((r) => r.outcome === "Charlie");
    expect(charlie?.grouped).toBe(true);

    const alice = report.rankings.find((r) => r.outcome === "Alice");
    expect(alice?.grouped).toBeFalsy();
  });
});

describe("parseReport — source merging", () => {
  const reportWithSources = `# Analysis: Test
Generated: 2026-01-01
Ticker: TEST

## Calibrator Report
KEY SOURCES:
- WMO Global Climate Update — WMO (2025)
- Berkeley Earth Temperature Report — Berkeley Earth (2025)
- Carbon Brief Analysis — Carbon Brief (2025)

ANALYST NOTES:
Done.

## Evidence Agent
Research done.

## SOURCES POOL
- [WMO Global Annual Climate Update](https://wmo.int/publication-series/climate-update)
- [Global Temperature Report for 2025 - Berkeley Earth](https://berkeleyearth.org/global-temperature-report-for-2025/)
- [When might the world exceed 1.5C? - Carbon Brief](https://www.carbonbrief.org/analysis-exceed-1-5c/)
- [Extra source not in KEY SOURCES](https://example.com/extra)

## Devil's Advocate
DA output.

## Resolution Analysis
Resolution output.

## Chaos Agent
Chaos output.`;

  const report = parseReport(reportWithSources);

  it("merges URLs from SOURCES POOL into KEY SOURCES by title matching", () => {
    const wmo = report.keySources.find((s) => s.title.includes("WMO"));
    expect(wmo?.url).toContain("wmo.int");

    const berkeley = report.keySources.find((s) => s.title.includes("Berkeley"));
    expect(berkeley?.url).toContain("berkeleyearth.org");

    const carbonBrief = report.keySources.find((s) => s.title.includes("Carbon Brief"));
    expect(carbonBrief?.url).toContain("carbonbrief.org");
  });

  it("includes extra pool sources not in KEY SOURCES", () => {
    const extra = report.keySources.find((s) => s.url?.includes("example.com/extra"));
    expect(extra).toBeDefined();
  });

  it("all merged sources have URLs", () => {
    for (const s of report.keySources) {
      expect(s.url.length).toBeGreaterThan(0);
    }
  });
});

describe("parseReport — sources pool formats", () => {
  it("parses pipe-separated format: [title] | [url]", () => {
    const report = parseReport(`## Calibrator Report
Done.

## Evidence Agent
Research.

## SOURCES POOL
- [NASA Temperature Data] | [https://nasa.gov/temp]
- [NOAA Report] | [https://noaa.gov/report]

## Devil's Advocate
DA.

## Resolution Analysis
Res.

## Chaos Agent
Chaos.`);

    const nasa = report.keySources.find((s) => s.title.includes("NASA"));
    expect(nasa?.url).toBe("https://nasa.gov/temp");
  });
});

describe("parseBets — binary format", () => {
  it("parses binary bet with cents and contracts", () => {
    const text = `**NO — $6 at 21 cents per contract (~29 contracts)**
- True p(NO) ≈ 31%
- Thesis: something`;
    const bets = parseBets(text);
    expect(bets).toHaveLength(1);
    expect(bets[0].direction).toBe("NO");
    expect(bets[0].amount).toBe(6);
    expect(bets[0].contracts).toBe(29);
    expect(bets[0].price).toBeCloseTo(0.21);
    expect(bets[0].payout).toBe(29);
    expect(bets[0].profit).toBe(23);
  });
});

describe("parseBets — table format", () => {
  it("parses event betting table", () => {
    const text = `All positions are NO.

| Market | Direction | Amount | Market Price | Estimate | Thesis |
|---|---|---|---|---|---|
| Tulsi Gabbard | NO | $18 | 41% YES | 25% | Loyal appointee |
| Kash Patel | NO | $17 | 41% YES | 26% | Mirror image |
| Pam Bondi | YES | $5 | 49% YES | 53% | Institutional pressure |`;
    const bets = parseBets(text);
    expect(bets).toHaveLength(3);

    // Gabbard: NO at 41% YES = buying NO at 59 cents
    expect(bets[0].market).toBe("Tulsi Gabbard");
    expect(bets[0].direction).toBe("NO");
    expect(bets[0].amount).toBe(18);
    expect(bets[0].price).toBeCloseTo(0.59);
    expect(bets[0].contracts).toBeCloseTo(18 / 0.59, 0);
    expect(bets[0].profit).toBeCloseTo(bets[0].payout - 18, 0);

    // Bondi: YES at 49 cents
    expect(bets[2].direction).toBe("YES");
    expect(bets[2].price).toBeCloseTo(0.49);
  });

  it("calculates correct total payout", () => {
    const text = `| Market | Direction | Amount | Market Price | Estimate | Thesis |
|---|---|---|---|---|---|
| A | NO | $50 | 30% YES | 20% | test |
| B | YES | $50 | 40% YES | 50% | test |`;
    const bets = parseBets(text);
    const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
    const totalPayout = bets.reduce((s, b) => s + b.payout, 0);
    expect(totalWagered).toBe(100);
    // A: 50 / 0.70 = ~71 contracts, payout $71
    // B: 50 / 0.40 = 125 contracts, payout $125
    expect(totalPayout).toBeGreaterThan(totalWagered);
  });

  it("returns empty for null input", () => {
    expect(parseBets(null)).toEqual([]);
  });

  it("returns empty for text with no recognizable bets", () => {
    expect(parseBets("Just some general text")).toEqual([]);
  });
});

describe("parseReport — edge cases", () => {
  it("handles empty/minimal input without crashing", () => {
    const report = parseReport("Some raw text with no structure");
    expect(report.rawCalibrator).toBe("Some raw text with no structure");
    expect(report.bullCase).toEqual([]);
    expect(report.keySources).toEqual([]);
  });

  it("handles report with only calibrator section", () => {
    const report = parseReport(`## Calibrator Report
ESTIMATED PROBABILITY:  50%
CONFIDENCE:             low`);
    expect(report.estimatedProbability).toBe("50%");
    expect(report.confidence).toBe("low");
  });
});
