import { describe, it, expect } from "vitest";
import { parseReport } from "../lib/reportParser";

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

## SOURCES POOL
- [CBO Report] | [https://cbo.gov/report]

## Devil's Advocate
Counter-arguments: historical precedent strongly favors last-minute deals (80% of shutdown threats resolve).

## Resolution Analysis
Resolution is clear: lapse in appropriations at midnight. No ambiguity in criteria.

## Chaos Agent
Scenarios:
1. "Presidential Emergency" - executive action bypasses Congress (2% probability)
2. "Discharge Petition Surprise" - moderate coalition forces vote (4% probability)
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

  it("parses key sources", () => {
    expect(report.keySources.length).toBe(2);
    expect(report.keySources[0].url).toContain("cbo.gov");
  });

  it("parses tail risks", () => {
    expect(report.tailRisks).toContain("Emergency presidential");
  });

  it("parses sub-agent sections", () => {
    expect(report.evidenceAgent).toContain("7 web searches");
    expect(report.devilsAdvocate).toContain("historical precedent");
    expect(report.resolutionAnalysis).toContain("lapse in appropriations");
    expect(report.chaosAgent).toContain("Discharge Petition");
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
