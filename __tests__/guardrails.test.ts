import { describe, it, expect } from "vitest";
import {
  validateCalibratorBinary,
  validateCalibratorEvent,
  buildRetryPrompt,
} from "../lib/guardrails/calibrator";
import {
  validateEvidenceAgent,
  validateDevilsAdvocate,
} from "../lib/guardrails/subagent";

// The validator receives the *raw calibrator section body* — what runAgent("opus", calibratorPrompt, ...)
// returns, before saveReport wraps it in "## Calibrator Report\n...".
const VALID_BINARY = `MARKET:     Will there be a government shutdown?
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

BEAR CASE:
- Historical precedent shows last-minute deals
- Leadership has signaled willingness to negotiate

TAIL RISKS:
Emergency presidential action could bypass normal process (~3%).

RESOLUTION WATCH:
Watch for any CR text being released.

KEY SOURCES:
- Congressional Budget Office analysis — https://cbo.gov/shutdown-2026
- Reuters: Shutdown talks stall — https://reuters.com/politics/shutdown

ANALYST NOTES:
Slightly underpriced given timeline.

CROSS-MARKET COMPARISON:
Polymarket prices this at 70%, Metaculus at 74%. These platforms typically converge within a few points on shutdown markets, and the divergence with Kalshi here reflects different liquidity profiles and the larger institutional flows that dominate Kalshi's order book on political contracts. No material arbitrage opportunity.

BETTING RECOMMENDATION ($100 BANKROLL):
Buy YES at 65c, $30 position (46 contracts).

PROBABILITY METHODOLOGY:
Base rate ~40%, adjusted upward for current dynamics.
`;

const VALID_EVENT = `EVENT:      Who will be the next Fed Chair?
CLOSES:     Jun 1, 2026
---
RANKING:
#1 MOST LIKELY: Kevin Warsh
   Market price: 45% | Your estimate: 50% | Edge: +5%
   Why: Strong political backing

#2: Jerome Powell
   Market price: 30% | Your estimate: 25% | Edge: -5%
   Why: Incumbent advantage but political headwinds

#3: Kevin Hassett
   Market price: 15% | Your estimate: 15% | Edge: ~0%
   Why: Dark horse

DARK HORSE:
Neel Kashkari has been mentioned but has no momentum.

TAIL RISKS:
Surprise nomination could scramble all probabilities.

CONFIDENCE: medium
CRUX: White House signaling strongly favors Warsh

RESOLUTION WATCH:
Resolves to whoever is nominated AND confirmed.

KEY SOURCES:
- WSJ: Warsh frontrunner — https://wsj.com/fedchair
- Bloomberg: Powell odds drop — https://bloomberg.com/powell

ANALYST NOTES:
Race is fluid; new info could shift rankings.

CROSS-MARKET COMPARISON:
Polymarket aligned within 3pp.

BETTING RECOMMENDATION ($100 BANKROLL):
Buy YES on Warsh at 45c, $40 position.

PROBABILITY METHODOLOGY:
Base rate of incumbent reappointment ~50%; adjusted for political headwinds.
`;

describe("validateCalibratorBinary", () => {
  it("accepts a well-formed binary report", () => {
    const result = validateCalibratorBinary(VALID_BINARY);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects when ESTIMATED PROBABILITY is 100%", () => {
    const bad = VALID_BINARY.replace("ESTIMATED PROBABILITY:  72%", "ESTIMATED PROBABILITY:  100%");
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("ESTIMATED PROBABILITY was 100%"))).toBe(true);
  });

  it("rejects when ESTIMATED PROBABILITY is 0%", () => {
    const bad = VALID_BINARY.replace("ESTIMATED PROBABILITY:  72%", "ESTIMATED PROBABILITY:  0%");
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("ESTIMATED PROBABILITY was 0%"))).toBe(true);
  });

  it("rejects when ESTIMATED PROBABILITY is missing entirely", () => {
    const bad = VALID_BINARY.replace(/ESTIMATED PROBABILITY:\s+72%\n/, "");
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("ESTIMATED PROBABILITY"))).toBe(true);
  });

  it("rejects when CRUX is missing", () => {
    const bad = VALID_BINARY.replace(/CRUX:[^\n]+\n/, "");
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("CRUX"))).toBe(true);
  });

  it("rejects when BULL CASE has only one bullet", () => {
    const bad = VALID_BINARY.replace(
      /BULL CASE:[\s\S]*?BEAR CASE:/,
      "BULL CASE:\n- Only one reason\n\nBEAR CASE:",
    );
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("BULL CASE has 1 bullet"))).toBe(true);
  });

  it("rejects when KEY SOURCES has fewer than 2 entries", () => {
    const bad = VALID_BINARY.replace(
      /KEY SOURCES:[\s\S]*?ANALYST NOTES:/,
      "KEY SOURCES:\n- Only source — https://example.com\n\nANALYST NOTES:",
    );
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("KEY SOURCES has 1 entries"))).toBe(true);
  });

  it("rejects an invalid CONFIDENCE value", () => {
    const bad = VALID_BINARY.replace("CONFIDENCE:             medium", "CONFIDENCE:             very high");
    const result = validateCalibratorBinary(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.toLowerCase().includes("confidence"))).toBe(true);
  });

  it("accepts probabilities at the boundary (1% and 99%)", () => {
    const lowProb = VALID_BINARY.replace("ESTIMATED PROBABILITY:  72%", "ESTIMATED PROBABILITY:  1%");
    expect(validateCalibratorBinary(lowProb).ok).toBe(true);
    const highProb = VALID_BINARY.replace("ESTIMATED PROBABILITY:  72%", "ESTIMATED PROBABILITY:  99%");
    expect(validateCalibratorBinary(highProb).ok).toBe(true);
  });
});

describe("validateCalibratorBinary cross-market gap check", () => {
  it("passes a small (5pp) gap regardless of justification depth", () => {
    // VALID_BINARY has "Polymarket prices this at 70%, Metaculus at 74%" with Calibrator at 72%.
    // Max gap ≈ 2pp. Should pass with the short prose already present.
    const result = validateCalibratorBinary(VALID_BINARY);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.includes("Cross-market gap"))).toBe(false);
  });

  it("fails a large gap (>15pp) when the cross-market section has only data", () => {
    const thin = VALID_BINARY.replace(
      /CROSS-MARKET COMPARISON:[\s\S]*?BETTING RECOMMENDATION/,
      `CROSS-MARKET COMPARISON:
Polymarket: 95%, Metaculus: 92%.

BETTING RECOMMENDATION`,
    );
    // Calibrator says 72%, Polymarket 95% → 23pp gap, no prose → must fail.
    const result = validateCalibratorBinary(thin);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.includes("Cross-market gap") && i.includes("23pp")),
    ).toBe(true);
  });

  it("passes a large gap when the section contains real prose justification", () => {
    const justified = VALID_BINARY.replace(
      /CROSS-MARKET COMPARISON:[\s\S]*?BETTING RECOMMENDATION/,
      `CROSS-MARKET COMPARISON:
Polymarket: 95%, Metaculus: 92%, Kalshi: 65%. The discrepancy stems from Polymarket's thin volume on this contract and a recent burst of momentum trades that have not yet been arbitraged. Metaculus runs about a week behind on the latest political developments because of its volunteer-driven update cadence, while Kalshi reflects the more cautious institutional money that better calibrates the actual base rate here.

BETTING RECOMMENDATION`,
    );
    const result = validateCalibratorBinary(justified);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.includes("Cross-market gap"))).toBe(false);
  });

  it("passes when section says 'No cross-market matches found'", () => {
    const noMatches = VALID_BINARY.replace(
      /CROSS-MARKET COMPARISON:[\s\S]*?BETTING RECOMMENDATION/,
      `CROSS-MARKET COMPARISON:
No cross-market matches found.

BETTING RECOMMENDATION`,
    );
    const result = validateCalibratorBinary(noMatches);
    expect(result.ok).toBe(true);
  });

  it("uses the platform with the LARGEST gap (not just the first found)", () => {
    // Calibrator 72%, Polymarket 70% (small gap 2pp), Metaculus 95% (big gap 23pp).
    // The issue message should call out Metaculus, not Polymarket.
    const mixed = VALID_BINARY.replace(
      /CROSS-MARKET COMPARISON:[\s\S]*?BETTING RECOMMENDATION/,
      `CROSS-MARKET COMPARISON:
Polymarket: 70%, Metaculus: 95%.

BETTING RECOMMENDATION`,
    );
    const result = validateCalibratorBinary(mixed);
    expect(result.ok).toBe(false);
    const gapIssue = result.issues.find((i) => i.includes("Cross-market gap"));
    expect(gapIssue).toBeDefined();
    expect(gapIssue).toContain("Metaculus");
    expect(gapIssue).not.toContain("Polymarket");
  });

  it("does nothing when no platform prices are mentioned in the section", () => {
    const noPrices = VALID_BINARY.replace(
      /CROSS-MARKET COMPARISON:[\s\S]*?BETTING RECOMMENDATION/,
      `CROSS-MARKET COMPARISON:
Cross-market data unavailable this run.

BETTING RECOMMENDATION`,
    );
    const result = validateCalibratorBinary(noPrices);
    expect(result.ok).toBe(true);
  });
});

describe("validateCalibratorEvent", () => {
  it("accepts a well-formed event report with matching ranking count", () => {
    const result = validateCalibratorEvent(VALID_EVENT, 3);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects when fewer rankings than expected", () => {
    const result = validateCalibratorEvent(VALID_EVENT, 5);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("RANKING has 3 entries"))).toBe(true);
  });

  it("rejects when a ranking estimate is 100%", () => {
    const bad = VALID_EVENT.replace(
      "Market price: 45% | Your estimate: 50% | Edge: +5%",
      "Market price: 45% | Your estimate: 100% | Edge: +55%",
    );
    const result = validateCalibratorEvent(bad, 3);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("estimate 100%"))).toBe(true);
  });

  it("rejects when KEY SOURCES has fewer than 2 entries", () => {
    const bad = VALID_EVENT.replace(
      /KEY SOURCES:[\s\S]*?ANALYST NOTES:/,
      "KEY SOURCES:\n- WSJ — https://wsj.com/fedchair\n\nANALYST NOTES:",
    );
    const result = validateCalibratorEvent(bad, 3);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("KEY SOURCES has 1 entries"))).toBe(true);
  });
});

describe("validateCalibratorEvent sum check", () => {
  // VALID_EVENT estimates: 50 + 25 + 15 = 90% → 0.90 ranking sum.
  it("passes when ranking sum is within tolerance of the expected sum", () => {
    // expectedRankingSum 0.90 ± 0.10 → estimateSum 0.90 is exactly on target.
    const result = validateCalibratorEvent(VALID_EVENT, 3, {
      expectedRankingSum: 0.90,
      tolerance: 0.10,
    });
    expect(result.ok).toBe(true);
  });

  it("passes at the edges of the tolerance window", () => {
    // expectedRankingSum 0.85 → window [0.75, 0.95]; estimates sum to 0.90, within window.
    const upperEdge = validateCalibratorEvent(VALID_EVENT, 3, {
      expectedRankingSum: 0.85,
      tolerance: 0.05,
    });
    expect(upperEdge.ok).toBe(true);
  });

  it("rejects an over-confident ranking sum", () => {
    // Bump every estimate way up → 80 + 60 + 50 = 190% sum.
    const bad = VALID_EVENT.replace(
      "Market price: 45% | Your estimate: 50% | Edge: +5%",
      "Market price: 45% | Your estimate: 80% | Edge: +35%",
    )
      .replace(
        "Market price: 30% | Your estimate: 25% | Edge: -5%",
        "Market price: 30% | Your estimate: 60% | Edge: +30%",
      )
      .replace(
        "Market price: 15% | Your estimate: 15% | Edge: ~0%",
        "Market price: 15% | Your estimate: 50% | Edge: +35%",
      );
    const result = validateCalibratorEvent(bad, 3, {
      expectedRankingSum: 1.0,
      tolerance: 0.10,
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.includes("Ranking estimates sum to 190%")),
    ).toBe(true);
  });

  it("rejects an under-confident ranking sum", () => {
    // 5 + 3 + 2 = 10% sum, way under the expected 100%.
    const bad = VALID_EVENT.replace(
      "Market price: 45% | Your estimate: 50% | Edge: +5%",
      "Market price: 45% | Your estimate: 5% | Edge: -40%",
    )
      .replace(
        "Market price: 30% | Your estimate: 25% | Edge: -5%",
        "Market price: 30% | Your estimate: 3% | Edge: -27%",
      )
      .replace(
        "Market price: 15% | Your estimate: 15% | Edge: ~0%",
        "Market price: 15% | Your estimate: 2% | Edge: -13%",
      );
    const result = validateCalibratorEvent(bad, 3, {
      expectedRankingSum: 1.0,
      tolerance: 0.10,
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.includes("Ranking estimates sum to 10%")),
    ).toBe(true);
  });

  it("skips the sum check when no SumCheckConfig is passed", () => {
    // Same over-confident fixture should pass without sumCheck (only fails ranking-range check).
    const wild = VALID_EVENT.replace(
      "Market price: 45% | Your estimate: 50% | Edge: +5%",
      "Market price: 45% | Your estimate: 80% | Edge: +35%",
    );
    const result = validateCalibratorEvent(wild, 3);
    // No sum-check failure should appear.
    expect(result.issues.some((i) => i.includes("sum to"))).toBe(false);
  });

  it("respects a lowered expected sum when sub-threshold tail is non-trivial", () => {
    // Sub-threshold sum is 0.20 → expectedRankingSum 0.80, tolerance 0.10 → window [0.70, 0.90].
    // Ranking sum 0.90 sits at the upper edge → passes.
    const result = validateCalibratorEvent(VALID_EVENT, 3, {
      expectedRankingSum: 0.80,
      tolerance: 0.10,
    });
    expect(result.ok).toBe(true);
  });
});

const VALID_EVIDENCE = `## FACTUAL SUMMARY

**Budget Status**
- No CR introduced as of March 2026 (Source: CBO, 2026-03-15)
- Both chambers in session through deadline (Source: Congress.gov)

## SOURCES POOL
- [CBO Budget Analysis](https://cbo.gov/report)
- [Reuters: Shutdown talks stall](https://reuters.com/politics/shutdown-2026)
- [Congress.gov floor schedule](https://congress.gov/schedule)
- [Politico: leadership signals](https://politico.com/leadership)
`;

const VALID_DA = `## COUNTERARGUMENTS

1. Historical precedent: 80% of shutdown threats resolve at the last minute.
2. Leadership has signaled willingness to negotiate (source below).

## ADDITIONAL SOURCES
- [Historical shutdown data](https://history.gov/shutdowns)
`;

describe("validateEvidenceAgent", () => {
  it("accepts a well-formed evidence output", () => {
    const result = validateEvidenceAgent(VALID_EVIDENCE);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects when SOURCES POOL is missing", () => {
    const bad = VALID_EVIDENCE.replace(/## SOURCES POOL[\s\S]*$/, "");
    const result = validateEvidenceAgent(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("SOURCES POOL"))).toBe(true);
  });

  it("rejects when SOURCES POOL has fewer than 3 URL entries", () => {
    const bad = `## FACTUAL SUMMARY
- Some fact (Source: CBO)

## SOURCES POOL
- [Only one](https://example.com)
- [Second](https://example.com/2)
`;
    const result = validateEvidenceAgent(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("2 URL-bearing entries"))).toBe(true);
  });

  it("does not count bullets that lack a URL", () => {
    const bad = `## SOURCES POOL
- A real one https://a.com
- Title only, no URL
- Another title without a link
`;
    const result = validateEvidenceAgent(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("1 URL-bearing entries"))).toBe(true);
  });
});

describe("validateDevilsAdvocate", () => {
  it("accepts a well-formed devil's advocate output", () => {
    const result = validateDevilsAdvocate(VALID_DA);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects when ADDITIONAL SOURCES is missing", () => {
    const bad = VALID_DA.replace(/## ADDITIONAL SOURCES[\s\S]*$/, "");
    const result = validateDevilsAdvocate(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("ADDITIONAL SOURCES"))).toBe(true);
  });

  it("rejects when ADDITIONAL SOURCES has zero URL entries", () => {
    const bad = `## COUNTERARGUMENTS\n1. argument\n\n## ADDITIONAL SOURCES\n- No new sources\n`;
    const result = validateDevilsAdvocate(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("0 URL-bearing entries"))).toBe(true);
  });
});

describe("buildRetryPrompt", () => {
  it("includes the original prompt, previous output, and issues", () => {
    const prompt = buildRetryPrompt(
      "ORIGINAL TASK: do the thing",
      "PREVIOUS BAD OUTPUT",
      ["Issue A", "Issue B"],
    );
    expect(prompt).toContain("ORIGINAL TASK: do the thing");
    expect(prompt).toContain("PREVIOUS BAD OUTPUT");
    expect(prompt).toContain("1. Issue A");
    expect(prompt).toContain("2. Issue B");
    expect(prompt).toMatch(/fixing every issue/i);
  });
});
