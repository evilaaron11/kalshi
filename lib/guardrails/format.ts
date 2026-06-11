import type { GuardrailReport, GuardrailAgent, ToolUsage } from "../types";

const AGENT_LABELS: Record<GuardrailAgent, string> = {
  evidence: "Evidence Agent",
  devils_advocate: "Devil's Advocate",
  calibrator: "Calibrator",
};

function formatUsage(u: ToolUsage): string {
  return `${u.webSearch} WebSearch, ${u.other} other`;
}

function shouldEmit(g: GuardrailReport): boolean {
  const anyIssues = g.results.some((r) => r.initialIssues.length > 0);
  const anyUsage = g.pipelineToolUsage.webSearch > 0 || g.pipelineToolUsage.other > 0;
  return anyIssues || anyUsage;
}

/**
 * Produce the "## Guardrail Notes" section for inclusion in a saved report.
 *
 * Layout:
 *   - A JSON payload in an HTML comment (`<!--guardrail-data: ...-->`) carries the
 *     structured GuardrailReport so the parser can recover it losslessly.
 *   - A pipeline-totals summary line.
 *   - A human-readable per-agent breakdown for agents whose initial output had issues.
 *     Clean agents with usage > 0 are omitted from the body but preserved in the JSON.
 *
 * Returns "" only when there are no issues AND no tool usage — i.e. a no-op pipeline.
 */
export function formatGuardrailSection(g: GuardrailReport | undefined): string {
  if (!g) return "";
  if (!shouldEmit(g)) return "";

  const json = JSON.stringify({
    results: g.results,
    pipelineToolUsage: g.pipelineToolUsage,
  });
  const lines: string[] = [
    "## Guardrail Notes",
    "",
    `<!--guardrail-data: ${json} -->`,
    "",
    `Pipeline tool usage: ${formatUsage(g.pipelineToolUsage)}.`,
    "",
  ];

  const dirty = g.results.filter((r) => r.initialIssues.length > 0);
  for (const r of dirty) {
    const label = AGENT_LABELS[r.agent];
    lines.push(`### ${label}`);
    lines.push(`Tool usage: ${formatUsage(r.toolUsage)}.`);
    lines.push("");
    if (r.retried) {
      lines.push(
        `Initial output failed validation (${r.initialIssues.length} issue${r.initialIssues.length === 1 ? "" : "s"}). Retried once.`,
      );
      lines.push("");
      lines.push("**Initial issues:**");
    } else {
      lines.push(
        `Output had ${r.initialIssues.length} validation issue${r.initialIssues.length === 1 ? "" : "s"} (no retry).`,
      );
      lines.push("");
      lines.push("**Issues:**");
    }
    for (const issue of r.initialIssues) lines.push(`- ${issue}`);

    if (r.retried && r.finalIssues.length > 0) {
      lines.push("");
      lines.push(`**Remaining after retry (${r.finalIssues.length}):**`);
      for (const issue of r.finalIssues) lines.push(`- ${issue}`);
    } else if (r.retried) {
      lines.push("");
      lines.push("Retry passed validation.");
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}
