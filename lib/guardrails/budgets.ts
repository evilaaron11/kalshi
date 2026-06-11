import type { GuardrailAgent, AgentGuardrailResult } from "../types";

export interface AgentBudget {
  /**
   * Max WebSearch calls before we flag "over budget". Soft limit — we count
   * and surface as a guardrail issue but do not abort the agent. Mirrors the
   * "SEARCH POLICY: ... up to N searches" line in each agent's prompt so the
   * code-enforced number matches what the model was told.
   */
  webSearch: number;
}

/**
 * Tracked agents. Resolution + Chaos also do WebSearch but currently have no
 * prompt-level cap, so we only roll their usage into pipeline totals — no per-
 * agent budget check.
 */
export const AGENT_BUDGETS: Record<GuardrailAgent, AgentBudget> = {
  evidence: { webSearch: 7 },
  devils_advocate: { webSearch: 5 },
  calibrator: { webSearch: 0 },
};

/**
 * Compare an agent's WebSearch count against its budget; append a guardrail
 * issue to BOTH initialIssues and finalIssues if over. Mutates the result in place.
 *
 * Notes:
 *   - Soft cap: we surface the overrun but never abort the agent or trigger a retry
 *     just for this. Retries can't undo tool calls already made.
 *   - The message is appended after any other validation issues, so it's the LAST
 *     entry in both arrays. This makes it easy to dedupe and easy to spot.
 */
export function applyToolBudget(result: AgentGuardrailResult): void {
  const budget = AGENT_BUDGETS[result.agent];
  if (!budget) return;
  const used = result.toolUsage.webSearch;
  if (used > budget.webSearch) {
    const msg = `WebSearch budget exceeded: used ${used}, budget ${budget.webSearch}`;
    if (!result.initialIssues.includes(msg)) result.initialIssues.push(msg);
    if (!result.finalIssues.includes(msg)) result.finalIssues.push(msg);
  }
}
