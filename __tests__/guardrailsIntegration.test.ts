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
import { formatGuardrailSection } from "../lib/guardrails/format";
import { applyToolBudget } from "../lib/guardrails/budgets";
import { parseReport } from "../lib/reportParser";
import type {
  GuardrailReport,
  AgentGuardrailResult,
  ToolUsage,
} from "../lib/types";

const ZERO_USAGE: ToolUsage = { webSearch: 0, other: 0 };

/** Helper: build an AgentGuardrailResult with sensible defaults for fields
 * that aren't the focus of a given test. */
function mkResult(partial: Partial<AgentGuardrailResult> & { agent: AgentGuardrailResult["agent"] }): AgentGuardrailResult {
  return {
    initialIssues: [],
    retried: false,
    finalIssues: [],
    toolUsage: { ...ZERO_USAGE },
    ...partial,
  };
}

/** Helper: wrap results into a GuardrailReport with a default pipelineToolUsage. */
function mkReport(results: AgentGuardrailResult[], pipelineToolUsage: ToolUsage = { ...ZERO_USAGE }): GuardrailReport {
  return { results, pipelineToolUsage };
}

/**
 * Wrap an arbitrary calibrator body + per-agent outputs as a full report so we can
 * feed it through parseReport like the real saveReport() output. Mirrors the exact
 * layout pipeline.ts writes.
 */
function buildReportFile(opts: {
  guardrailSection: string;
  calibrator?: string;
  evidence?: string;
  da?: string;
}): string {
  return `# Analysis: Sanity check
Generated: 2026-06-10T16:00:00Z
Ticker: KXSANITY

${opts.guardrailSection}## Calibrator Report
${opts.calibrator ?? "stub"}

## Evidence Agent
${opts.evidence ?? "stub"}

## Devil's Advocate
${opts.da ?? "stub"}

## Resolution Analysis
stub

## Chaos Agent
stub
`;
}

describe("guardrails: format → parse round-trip", () => {
  it("preserves a single-agent failure with retry-resolved", () => {
    const original = mkReport([
      mkResult({
        agent: "calibrator",
        initialIssues: ["CRUX missing", "KEY SOURCES has 1 entries — need at least 2"],
        retried: true,
        finalIssues: [],
      }),
    ]);

    const section = formatGuardrailSection(original);
    expect(section).toContain("## Guardrail Notes");
    expect(section).toContain("### Calibrator");
    expect(section).toContain("Retried once");
    expect(section).toContain("Retry passed validation");

    const reportFile = buildReportFile({ guardrailSection: section });
    const parsed = parseReport(reportFile);

    expect(parsed.guardrailNotes).not.toBeNull();
    expect(parsed.guardrailNotes!.results).toEqual(original.results);
  });

  it("preserves a multi-agent failure with mixed retry outcomes", () => {
    const original = mkReport([
      mkResult({
        agent: "evidence",
        initialIssues: ["SOURCES POOL has 2 URL-bearing entries — need at least 3"],
        retried: true,
        finalIssues: [],
      }),
      mkResult({ agent: "devils_advocate" }),
      mkResult({
        agent: "calibrator",
        initialIssues: [
          "ESTIMATED PROBABILITY was 100% — must be in [1, 99]",
          "BULL CASE has 1 bullet(s) — need at least 2",
        ],
        retried: true,
        finalIssues: ["BULL CASE has 1 bullet(s) — need at least 2"],
      }),
    ]);

    const section = formatGuardrailSection(original);
    // Only failing agents appear in markdown body
    expect(section).toContain("### Evidence Agent");
    expect(section).not.toContain("### Devil's Advocate"); // clean agent omitted
    expect(section).toContain("### Calibrator");
    expect(section).toContain("Remaining after retry (1)");

    const reportFile = buildReportFile({ guardrailSection: section });
    const parsed = parseReport(reportFile);

    // JSON-comment payload preserves ALL agents (including the clean DA)
    expect(parsed.guardrailNotes).not.toBeNull();
    expect(parsed.guardrailNotes!.results).toHaveLength(3);
    expect(parsed.guardrailNotes!.results).toEqual(original.results);
  });

  it("emits no guardrail section when all agents passed AND no tool usage", () => {
    const clean = mkReport([
      mkResult({ agent: "evidence" }),
      mkResult({ agent: "devils_advocate" }),
      mkResult({ agent: "calibrator" }),
    ]);
    expect(formatGuardrailSection(clean)).toBe("");

    const reportFile = buildReportFile({ guardrailSection: "" });
    const parsed = parseReport(reportFile);
    expect(parsed.guardrailNotes).toBeNull();
  });

  it("emits guardrail section when clean but tool usage > 0", () => {
    // Real pipelines always consume tools — section is emitted so totals are visible.
    const cleanWithUsage = mkReport(
      [
        mkResult({ agent: "evidence", toolUsage: { webSearch: 7, other: 2 } }),
        mkResult({ agent: "devils_advocate", toolUsage: { webSearch: 3, other: 0 } }),
        mkResult({ agent: "calibrator", toolUsage: { webSearch: 0, other: 1 } }),
      ],
      { webSearch: 10, other: 3 },
    );
    const section = formatGuardrailSection(cleanWithUsage);
    expect(section).toContain("Pipeline tool usage: 10 WebSearch, 3 other");
    // No per-agent ### sections because no agent had issues
    expect(section).not.toContain("### Evidence Agent");
  });

  it("emits no guardrail section when report is undefined", () => {
    expect(formatGuardrailSection(undefined)).toBe("");
  });
});

describe("guardrails: validator → format → parse end-to-end", () => {
  it("flags a Calibrator output with prob 100% and surfaces it in the parsed report", () => {
    const badCalibrator = `MARKET: Will X happen
CLOSES: Apr 1, 2026 | VOLUME: 1000
---
ESTIMATED PROBABILITY:  100%
MARKET PRICE:           90%
EDGE:                   +10% -> lean YES
CONFIDENCE:             high
CRUX:                   The thing will happen

BULL CASE:
- It will
- Definitely will

BEAR CASE:
- It won't
- Possibly not

TAIL RISKS:
None material.

KEY SOURCES:
- One source — https://a.com
- Two source — https://b.com

BETTING RECOMMENDATION ($100 BANKROLL):
Go all in.

PROBABILITY METHODOLOGY:
Trust me.
`;

    const check = validateCalibratorBinary(badCalibrator);
    expect(check.ok).toBe(false);

    // Build a GuardrailReport as the pipeline would for a non-retried failure
    const result = mkResult({
      agent: "calibrator",
      initialIssues: check.issues,
      finalIssues: check.issues,
    });
    const report = mkReport([result]);

    const section = formatGuardrailSection(report);
    const reportFile = buildReportFile({ guardrailSection: section });
    const parsed = parseReport(reportFile);

    expect(parsed.guardrailNotes).not.toBeNull();
    expect(parsed.guardrailNotes!.results[0].initialIssues).toEqual(check.issues);
    expect(parsed.guardrailNotes!.results[0].initialIssues.some((i) => i.includes("100%"))).toBe(true);
  });

  it("flags an Evidence output missing SOURCES POOL", () => {
    const badEvidence = `## FACTUAL SUMMARY
- The sky is blue (Source: obvious)
- Grass is green (Source: also obvious)
`;
    const check = validateEvidenceAgent(badEvidence);
    expect(check.ok).toBe(false);
    expect(check.issues[0]).toContain("SOURCES POOL");

    const report = mkReport([
      mkResult({ agent: "evidence", initialIssues: check.issues, finalIssues: check.issues }),
    ]);
    const parsed = parseReport(buildReportFile({ guardrailSection: formatGuardrailSection(report) }));
    expect(parsed.guardrailNotes!.results[0].agent).toBe("evidence");
    expect(parsed.guardrailNotes!.results[0].initialIssues[0]).toContain("SOURCES POOL");
  });

  it("flags a mutually-exclusive event with ranking sum way off", () => {
    const badEvent = `EVENT: Sanity event
CLOSES: Jun 1, 2026
---
RANKING:
#1 MOST LIKELY: A
   Market price: 40% | Your estimate: 80% | Edge: +40%
   Why: reason

#2: B
   Market price: 30% | Your estimate: 60% | Edge: +30%
   Why: reason

#3: C
   Market price: 20% | Your estimate: 50% | Edge: +30%
   Why: reason

CONFIDENCE: medium
CRUX: sample crux

KEY SOURCES:
- One — https://a.com
- Two — https://b.com

BETTING RECOMMENDATION ($100 BANKROLL):
Buy YES on A at 40c.

PROBABILITY METHODOLOGY:
Base rates and adjustments.
`;
    const check = validateCalibratorEvent(badEvent, 3, {
      expectedRankingSum: 1.0,
      tolerance: 0.10,
    });
    expect(check.ok).toBe(false);
    // 80 + 60 + 50 = 190%
    expect(check.issues.some((i) => i.includes("sum to 190%"))).toBe(true);

    const report = mkReport([
      mkResult({ agent: "calibrator", initialIssues: check.issues, finalIssues: check.issues }),
    ]);
    const parsed = parseReport(buildReportFile({ guardrailSection: formatGuardrailSection(report) }));
    expect(parsed.guardrailNotes!.results[0].initialIssues.some((i) => i.includes("190%"))).toBe(true);
  });

  it("flags DA missing ADDITIONAL SOURCES header", () => {
    const badDA = `## COUNTERARGUMENTS\n1. The market is wrong because X.\n`;
    const check = validateDevilsAdvocate(badDA);
    expect(check.ok).toBe(false);
    expect(check.issues[0]).toContain("ADDITIONAL SOURCES");

    const report = mkReport([
      mkResult({ agent: "devils_advocate", initialIssues: check.issues, finalIssues: check.issues }),
    ]);
    const parsed = parseReport(buildReportFile({ guardrailSection: formatGuardrailSection(report) }));
    expect(parsed.guardrailNotes!.results[0].agent).toBe("devils_advocate");
  });
});

describe("guardrails: applyToolBudget (#4)", () => {
  it("adds no issue when usage is at or under budget", () => {
    const result = mkResult({
      agent: "evidence",
      toolUsage: { webSearch: 7, other: 3 }, // exactly at budget
    });
    applyToolBudget(result);
    expect(result.initialIssues).toEqual([]);
    expect(result.finalIssues).toEqual([]);
  });

  it("appends a budget-exceeded issue to both lists when over budget", () => {
    const result = mkResult({
      agent: "evidence",
      toolUsage: { webSearch: 10, other: 0 }, // 3 over a 7 budget
    });
    applyToolBudget(result);
    const msg = "WebSearch budget exceeded: used 10, budget 7";
    expect(result.initialIssues).toContain(msg);
    expect(result.finalIssues).toContain(msg);
  });

  it("does not duplicate the budget issue if invoked twice", () => {
    const result = mkResult({
      agent: "devils_advocate",
      toolUsage: { webSearch: 8, other: 0 }, // 3 over a 5 budget
    });
    applyToolBudget(result);
    applyToolBudget(result);
    expect(result.initialIssues.filter((i) => i.includes("budget exceeded"))).toHaveLength(1);
    expect(result.finalIssues.filter((i) => i.includes("budget exceeded"))).toHaveLength(1);
  });

  it("flags any non-zero usage for Calibrator (budget = 0)", () => {
    const result = mkResult({
      agent: "calibrator",
      toolUsage: { webSearch: 1, other: 0 },
    });
    applyToolBudget(result);
    expect(result.initialIssues.some((i) => i.includes("used 1, budget 0"))).toBe(true);
  });
});

describe("guardrails: #4 + #5 together end-to-end", () => {
  // Realistic scenario: model went over WebSearch budget AND produced a Calibrator
  // output with a large cross-market gap and no justification. Both issues should
  // surface, round-trip through format/parse, and only the cross-market issue
  // should make it into a retry prompt (budget can't be undone by retrying).
  const BAD_CALIBRATOR = `MARKET: Will the shutdown end by Apr 1
CLOSES: Apr 1, 2026 | VOLUME: 5000
---
ESTIMATED PROBABILITY:  35%
MARKET PRICE:           58%
EDGE:                   -23% -> lean NO
CONFIDENCE:             medium
CRUX:                   Negotiations have stalled and there's no path to a CR.

BULL CASE:
- Leadership making last-ditch effort
- Public pressure mounting

BEAR CASE:
- Both parties dug in on spending
- No CR text introduced

TAIL RISKS:
None material.

RESOLUTION WATCH:
Resolves at midnight on close date.

KEY SOURCES:
- Reuters update — https://reuters.com/x
- CBO analysis — https://cbo.gov/y

ANALYST NOTES:
Some notes here.

CROSS-MARKET COMPARISON:
Polymarket: 60%, Metaculus: 65%.

BETTING RECOMMENDATION ($100 BANKROLL):
Buy NO at 42c, $30.

PROBABILITY METHODOLOGY:
Base rate and adjustments.
`;

  it("Calibrator validator flags the cross-market gap (#5)", () => {
    const check = validateCalibratorBinary(BAD_CALIBRATOR);
    expect(check.ok).toBe(false);
    // Calibrator 35% vs Polymarket 60% = 25pp gap; Metaculus 65% = 30pp gap
    // → max gap is Metaculus at 30pp, no prose justification.
    expect(check.issues.some((i) => i.includes("Cross-market gap") && i.includes("Metaculus") && i.includes("30pp"))).toBe(true);
  });

  it("applyToolBudget adds budget overrun on top of validator issues (#4)", () => {
    const check = validateCalibratorBinary(BAD_CALIBRATOR);
    const result = mkResult({
      agent: "calibrator",
      initialIssues: [...check.issues],
      finalIssues: [...check.issues],
      toolUsage: { webSearch: 4, other: 1 }, // 4 over a 0 budget for Calibrator
    });
    applyToolBudget(result);

    expect(result.initialIssues.some((i) => i.includes("Cross-market gap"))).toBe(true);
    expect(result.initialIssues.some((i) => i.includes("budget exceeded"))).toBe(true);
  });

  it("the retry prompt would contain cross-market issue but NOT budget overrun", () => {
    // Mirrors pipeline.ts ordering: buildRetryPrompt is called with firstCheck.issues
    // (validator output only); applyToolBudget runs AFTER and mutates the result for
    // surfacing/report — but never goes into the retry prompt.
    const check = validateCalibratorBinary(BAD_CALIBRATOR);
    const retryPrompt = buildRetryPrompt(
      "ORIGINAL CALIBRATOR PROMPT",
      "previous bad output",
      check.issues,
    );
    expect(retryPrompt).toContain("Cross-market gap");
    expect(retryPrompt).not.toContain("budget exceeded");
  });

  it("both issues round-trip through format → parse and surface in the saved report", () => {
    const check = validateCalibratorBinary(BAD_CALIBRATOR);
    const result = mkResult({
      agent: "calibrator",
      initialIssues: [...check.issues],
      finalIssues: [...check.issues],
      toolUsage: { webSearch: 4, other: 1 },
    });
    applyToolBudget(result);

    const report = mkReport([result], { webSearch: 14, other: 6 });
    const section = formatGuardrailSection(report);

    // Markdown contains both
    expect(section).toContain("Cross-market gap");
    expect(section).toContain("WebSearch budget exceeded");
    expect(section).toContain("Pipeline tool usage: 14 WebSearch, 6 other");

    // Round-trip preserves them
    const parsed = parseReport(buildReportFile({ guardrailSection: section }));
    const calResult = parsed.guardrailNotes!.results.find((r) => r.agent === "calibrator")!;
    expect(calResult.initialIssues.some((i) => i.includes("Cross-market gap"))).toBe(true);
    expect(calResult.initialIssues.some((i) => i.includes("budget exceeded"))).toBe(true);
    expect(calResult.toolUsage).toEqual({ webSearch: 4, other: 1 });
    expect(parsed.guardrailNotes!.pipelineToolUsage).toEqual({ webSearch: 14, other: 6 });
  });
});

describe("guardrails: budget definitions", () => {
  it("Evidence budget matches the prompt's stated soft limit (7 WebSearch)", async () => {
    const { AGENT_BUDGETS } = await import("../lib/guardrails/budgets");
    expect(AGENT_BUDGETS.evidence.webSearch).toBe(7);
  });

  it("Devil's Advocate budget matches the prompt's stated soft limit (5 WebSearch)", async () => {
    const { AGENT_BUDGETS } = await import("../lib/guardrails/budgets");
    expect(AGENT_BUDGETS.devils_advocate.webSearch).toBe(5);
  });

  it("Calibrator budget is 0 (no tools allowed)", async () => {
    const { AGENT_BUDGETS } = await import("../lib/guardrails/budgets");
    expect(AGENT_BUDGETS.calibrator.webSearch).toBe(0);
  });
});

describe("guardrails: tool usage round-trip", () => {
  it("preserves per-agent toolUsage and pipelineToolUsage through format → parse", () => {
    const original = mkReport(
      [
        mkResult({
          agent: "evidence",
          toolUsage: { webSearch: 7, other: 3 },
          initialIssues: ["CRUX missing"], // need some issue so per-agent body is emitted
          finalIssues: ["CRUX missing"],
        }),
      ],
      { webSearch: 12, other: 5 },
    );
    const section = formatGuardrailSection(original);
    expect(section).toContain("Pipeline tool usage: 12 WebSearch, 5 other");
    expect(section).toContain("Tool usage: 7 WebSearch, 3 other");

    const parsed = parseReport(buildReportFile({ guardrailSection: section }));
    expect(parsed.guardrailNotes!.pipelineToolUsage).toEqual({ webSearch: 12, other: 5 });
    expect(parsed.guardrailNotes!.results[0].toolUsage).toEqual({ webSearch: 7, other: 3 });
  });

  it("recovers toolUsage from the markdown fallback parser (no JSON comment)", () => {
    const handWritten = `## Guardrail Notes

Pipeline tool usage: 9 WebSearch, 4 other.

### Evidence Agent
Tool usage: 7 WebSearch, 2 other.

Output had 1 validation issue (no retry).

**Issues:**
- SOURCES POOL has 1 URL-bearing entries — need at least 3

`;
    const parsed = parseReport(buildReportFile({ guardrailSection: handWritten }));
    expect(parsed.guardrailNotes!.pipelineToolUsage).toEqual({ webSearch: 9, other: 4 });
    expect(parsed.guardrailNotes!.results[0].toolUsage).toEqual({ webSearch: 7, other: 2 });
  });
});

describe("guardrails: markdown fallback parser (no JSON comment)", () => {
  // If a hand-edited or older .md is missing the JSON payload, parseGuardrailNotes
  // should still recover what it can from the human-readable subsections.
  it("falls back to parsing ### sections when JSON comment is missing", () => {
    const handWritten = `## Guardrail Notes

### Evidence Agent
Initial output failed validation (1 issue). Retried once.

**Initial issues:**
- SOURCES POOL has 2 URL-bearing entries — need at least 3

Retry passed validation.

### Calibrator
Output had 1 validation issue (no retry).

**Issues:**
- CRUX missing

`;
    const reportFile = buildReportFile({ guardrailSection: handWritten });
    const parsed = parseReport(reportFile);

    expect(parsed.guardrailNotes).not.toBeNull();
    expect(parsed.guardrailNotes!.results).toHaveLength(2);

    const evidence = parsed.guardrailNotes!.results.find((r) => r.agent === "evidence")!;
    expect(evidence.retried).toBe(true);
    expect(evidence.initialIssues).toEqual(["SOURCES POOL has 2 URL-bearing entries — need at least 3"]);
    expect(evidence.finalIssues).toEqual([]);

    const cal = parsed.guardrailNotes!.results.find((r) => r.agent === "calibrator")!;
    expect(cal.retried).toBe(false);
    expect(cal.initialIssues).toEqual(["CRUX missing"]);
    expect(cal.finalIssues).toEqual(["CRUX missing"]); // no-retry case
  });
});
