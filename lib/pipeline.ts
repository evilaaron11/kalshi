import fs from "fs";
import path from "path";
import { fetchMarket } from "./kalshi";
import { runClaudeAgent } from "@evilaaron11/claude-gateway-client";
import type {
  MarketData,
  ParsedMarket,
  EventData,
  PipelineEvent,
  PipelineStage,
  StageEvent,
  ProgressEvent,
  CompleteEvent,
  ToolCategory,
  GuardrailReport,
  AgentGuardrailResult,
  GuardrailAgent,
  ToolUsage,
} from "./types";
import { isEventData } from "./types";
import * as prompts from "./prompts";
import {
  validateCalibratorBinary,
  validateCalibratorEvent,
  buildRetryPrompt,
  type SumCheckConfig,
  type ValidationResult,
} from "./guardrails/calibrator";
import {
  validateEvidenceAgent,
  validateDevilsAdvocate,
} from "./guardrails/subagent";
import { formatGuardrailSection } from "./guardrails/format";
import { applyToolBudget } from "./guardrails/budgets";

// Mutually-exclusive sum check applies when total Kalshi YES prices across all event
// markets (qualifying + sub-threshold) fall in this band — i.e., Kalshi's own pricing
// treats the outcomes as a partition. Tolerance on Calibrator's ranking sum is ±10pp
// off the expected (1 - subThresholdYesSum) target.
const MUTEX_DETECT_BAND: [number, number] = [0.85, 1.15];
const MUTEX_TOLERANCE = 0.10;

// --- Claude CLI runner ---

/**
 * Run a Claude Code agent as a subprocess using the user's Max subscription.
 * Uses `claude -p --model <model> --output-format stream-json` for real-time progress.
 * Calls onProgress with human-readable status updates as the agent works.
 */
interface ToolProgress {
  detail: string;
  toolName: string;
  toolCategory: ToolCategory;
}

function classifyTool(toolName: string, input: Record<string, unknown>): ToolProgress {
  if (toolName === "WebSearch" || toolName === "web_search") {
    return {
      detail: `Searching: ${input.query || "..."}`,
      toolName: "WebSearch",
      toolCategory: "search",
    };
  }
  if (toolName === "Bash") {
    const cmd = (input.command as string) || "";
    if (cmd.includes("cli.ts cross-market")) {
      const q = cmd.match(/--query\s+"([^"]+)"/)?.[1] || "";
      return { detail: `Cross-market lookup: ${q}`, toolName: "cross-market", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts whitehouse")) {
      const q = cmd.match(/--search\s+"([^"]+)"/)?.[1] || "";
      return { detail: `White House search: ${q}`, toolName: "whitehouse", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts oira")) {
      const q = cmd.match(/--search\s+"([^"]+)"/)?.[1] || "";
      return { detail: `OIRA/Fed Register: ${q}`, toolName: "oira", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts fec")) {
      const who = cmd.match(/--(?:candidate|committee)\s+"([^"]+)"/)?.[1] || "";
      return { detail: `FEC lookup: ${who}`, toolName: "fec", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts polling")) {
      const race = cmd.match(/--race\s+"([^"]+)"/)?.[1] || "";
      return { detail: `Polling data: ${race}`, toolName: "polling", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts congress")) {
      const q = cmd.match(/--(?:search|bill)\s+"([^"]+)"/)?.[1] || "floor schedule";
      return { detail: `Congress lookup: ${q}`, toolName: "congress", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts fred")) {
      const q = cmd.match(/--(?:series|search)\s+"([^"]+)"/)?.[1] || "";
      return { detail: `FRED data: ${q}`, toolName: "fred", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts confirmations")) {
      const q = cmd.match(/--position\s+"([^"]+)"/)?.[1] || "history";
      return { detail: `Confirmation lookup: ${q}`, toolName: "confirmations", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts pvi")) {
      const q = cmd.match(/--state\s+"([^"]+)"/)?.[1] || "competitive";
      return { detail: `PVI data: ${q}`, toolName: "pvi", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts senate")) {
      const q = cmd.match(/--whip\s+"([^"]+)"/)?.[1] || "votes";
      return { detail: `Senate lookup: ${q}`, toolName: "senate", toolCategory: "fetcher" };
    }
    return { detail: `Running: ${cmd.slice(0, 80)}`, toolName: "Bash", toolCategory: "bash" };
  }
  // MCP tool calls — extract module and function from tool name
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    const module = parts[2] || "gov";
    const fn = parts.slice(3).join("_") || "";
    const moduleLabels: Record<string, string> = {
      treasury: "Treasury",
      fred: "FRED",
      bls: "Labor Stats",
      bea: "BEA",
      congress: "Congress",
      fec: "FEC",
      federalregister: "Fed Register",
      regulations: "Regulations",
      senatelobbying: "Lobbying",
      sec: "SEC",
      govinfo: "GovInfo",
      usaspending: "USAspending",
      fbi: "FBI",
      census: "Census",
    };
    const label = moduleLabels[module] || module;
    return { detail: `${label}: ${fn.replace(/_/g, " ")}`, toolName: `mcp-${module}`, toolCategory: "fetcher" };
  }
  return { detail: `Using ${toolName}...`, toolName, toolCategory: "thinking" };
}

async function runAgent(
  model: "haiku" | "sonnet" | "opus",
  prompt: string,
  allowedTools: string[] = ["WebSearch", "Bash"],
  onProgress?: (progress: ToolProgress) => void,
  signal?: AbortSignal,
  useMcp = false,
): Promise<string> {
  // Routes to the in-cluster claude-gateway when CLAUDE_GATEWAY_URL is set, otherwise
  // spawns `claude` locally (dev without a gateway). The progress mapping below is
  // backend-agnostic — it reads the same Claude Code stream-json events either way.
  return runClaudeAgent({ model, prompt, allowedTools, useMcp, signal }, (event) => {
    if (event.type !== "assistant" || !event.message?.content) return;
    for (const block of event.message.content) {
      if (block.type === "tool_use" && onProgress) {
        onProgress(classifyTool(block.name || "tool", block.input || {}));
      }
      // Emit agent reasoning text as progress
      if (block.type === "text" && block.text && onProgress) {
        const text = (block.text as string).trim();
        if (text.length > 0) {
          const firstLine = text.split("\n").find((l: string) => l.trim().length > 0) || text;
          const snippet = firstLine.length > 150 ? firstLine.slice(0, 147) + "..." : firstLine;
          onProgress({ detail: snippet, toolName: "reasoning", toolCategory: "reasoning" });
        }
      }
      // Emit thinking blocks as progress
      if (block.type === "thinking" && block.thinking && onProgress) {
        const thinking = (block.thinking as string).trim();
        if (thinking.length > 0) {
          const firstLine = thinking.split("\n").find((l: string) => l.trim().length > 0) || thinking;
          const snippet = firstLine.length > 150 ? firstLine.slice(0, 147) + "..." : firstLine;
          onProgress({ detail: snippet, toolName: "thinking", toolCategory: "thinking" });
        }
      }
    }
  });
}

// --- Pipeline run ---

export class PipelineRun {
  runId: string;
  ticker: string;
  events: PipelineEvent[] = [];
  reportContent: string | null = null;
  guardrailReport: GuardrailReport | null = null;
  private listeners: ((event: PipelineEvent | null) => void)[] = [];
  private abortController = new AbortController();
  private running = false;
  /** Per-stage tool counts populated by progressCallback during streaming. */
  private toolCounts: Map<PipelineStage, ToolUsage> = new Map();

  constructor(ticker: string) {
    this.runId = Math.random().toString(36).slice(2, 14);
    this.ticker = ticker;
  }

  get cancelled() {
    return this.abortController.signal.aborted;
  }

  private emit(event: PipelineEvent) {
    this.events.push(event);
    for (const listener of this.listeners) listener(event);
  }

  private emitStage(
    stage: StageEvent["stage"],
    status: StageEvent["status"],
    extra?: Partial<StageEvent>,
  ) {
    this.emit({ kind: "stage", stage, status, ...extra });
  }

  private emitProgress(stage: PipelineStage, progress: ToolProgress) {
    this.emit({
      kind: "progress",
      stage,
      detail: progress.detail,
      toolName: progress.toolName,
      toolCategory: progress.toolCategory,
      timestamp: Date.now(),
    } as ProgressEvent);
  }

  private progressCallback(stage: PipelineStage) {
    return (progress: ToolProgress) => {
      // Tool counting: only count actual tool_use blocks (search/fetcher/bash).
      // "thinking" and "reasoning" categories are text blocks, not tool calls.
      if (progress.toolCategory === "search") {
        this.bumpCount(stage, "webSearch");
      } else if (progress.toolCategory === "fetcher" || progress.toolCategory === "bash") {
        this.bumpCount(stage, "other");
      }
      this.emitProgress(stage, progress);
    };
  }

  private bumpCount(stage: PipelineStage, kind: keyof ToolUsage) {
    const cur = this.toolCounts.get(stage) ?? { webSearch: 0, other: 0 };
    cur[kind]++;
    this.toolCounts.set(stage, cur);
  }

  private getToolUsage(stage: PipelineStage): ToolUsage {
    return this.toolCounts.get(stage) ?? { webSearch: 0, other: 0 };
  }

  private pipelineToolTotals(): ToolUsage {
    let webSearch = 0;
    let other = 0;
    for (const u of this.toolCounts.values()) {
      webSearch += u.webSearch;
      other += u.other;
    }
    return { webSearch, other };
  }

  subscribe(fn: (event: PipelineEvent | null) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  cancel() {
    this.abortController.abort();
  }

  isRunning() {
    return this.running;
  }

  private signalEnd() {
    for (const listener of this.listeners) listener(null);
  }

  /**
   * Run an agent, validate its output, and retry once if validation fails.
   * Returns the final output (post-retry if one happened) and an AgentGuardrailResult
   * describing what happened. Used identically for Evidence, Devil's Advocate, and Calibrator.
   */
  private async runWithGuardrail(opts: {
    agent: GuardrailAgent;
    stage: PipelineStage;
    model: "haiku" | "sonnet" | "opus";
    prompt: string;
    allowedTools: string[];
    useMcp?: boolean;
    validate: (text: string) => ValidationResult;
    signal: AbortSignal;
  }): Promise<{ output: string; result: AgentGuardrailResult }> {
    const initial = await runAgent(
      opts.model,
      opts.prompt,
      opts.allowedTools,
      this.progressCallback(opts.stage),
      opts.signal,
      opts.useMcp ?? false,
    );

    const firstCheck = opts.validate(initial);
    const result: AgentGuardrailResult = {
      agent: opts.agent,
      initialIssues: firstCheck.issues,
      retried: false,
      finalIssues: firstCheck.issues,
      toolUsage: this.getToolUsage(opts.stage),
    };

    if (firstCheck.ok || this.cancelled) {
      applyToolBudget(result);
      return { output: initial, result };
    }

    this.emitProgress(opts.stage, {
      detail: `Validation failed (${firstCheck.issues.length} issue${firstCheck.issues.length === 1 ? "" : "s"}) — retrying`,
      toolName: "guardrail",
      toolCategory: "thinking",
    });
    const retryPrompt = buildRetryPrompt(opts.prompt, initial, firstCheck.issues);
    const retry = await runAgent(
      opts.model,
      retryPrompt,
      opts.allowedTools,
      this.progressCallback(opts.stage),
      opts.signal,
      opts.useMcp ?? false,
    );
    const secondCheck = opts.validate(retry);
    result.retried = true;
    result.finalIssues = secondCheck.issues;
    // Re-read tool usage after retry — counts accumulate via progressCallback for both attempts.
    result.toolUsage = this.getToolUsage(opts.stage);
    applyToolBudget(result);
    return { output: retry, result };
  }

  async run(): Promise<void> {
    this.running = true;

    try {
      // --- Fetch ---
      this.emitStage("fetch", "running");
      const t0 = Date.now();
      const marketData = await fetchMarket(this.ticker);
      this.emitStage("fetch", "complete", {
        durationS: (Date.now() - t0) / 1000,
      });

      if (this.cancelled) return;

      const isEvent = isEventData(marketData);

      // Build context strings
      let title: string;
      let resolutionCriteria: string;
      let closeDate: string;
      let yesPrice: string;
      let volume: number;
      let outcomesText = "";
      let subText = "";

      if (isEvent) {
        const ed = marketData as EventData;
        title = ed.title;
        resolutionCriteria = ed.markets[0]?.resolutionCriteria || "";
        closeDate = ed.markets[0]?.closeDate || "";
        yesPrice = "";
        volume = ed.markets.reduce((s, m) => s + m.volume, 0);
        outcomesText = ed.markets
          .map(
            (m, i) =>
              `${i + 1}. ${m.yesSubTitle || m.title} — YES ${(m.yesPrice * 100).toFixed(0)}%`,
          )
          .join("\n");
        subText =
          ed.subThresholdMarkets.length > 0
            ? ed.subThresholdMarkets
                .map(
                  (m) =>
                    `- ${m.yesSubTitle || m.title} — YES ${(m.yesPrice * 100).toFixed(1)}%`,
                )
                .join("\n")
            : "None";
      } else {
        const pm = marketData as ParsedMarket;
        title = pm.title;
        resolutionCriteria = pm.resolutionCriteria;
        closeDate = pm.closeDate;
        yesPrice = `${(pm.yesPrice * 100).toFixed(0)}%`;
        volume = pm.volume;
      }

      const guardrailResults: AgentGuardrailResult[] = [];

      // --- Evidence ---
      this.emitStage("evidence", "running");
      const t1 = Date.now();
      const evidencePrompt = isEvent
        ? prompts.evidenceEvent(title, closeDate, resolutionCriteria, outcomesText)
        : prompts.evidenceBinary(title, resolutionCriteria, closeDate, yesPrice);

      const signal = this.abortController.signal;
      const evidenceRun = await this.runWithGuardrail({
        agent: "evidence",
        stage: "evidence",
        model: "haiku",
        prompt: evidencePrompt,
        allowedTools: ["WebSearch", "Bash"],
        useMcp: true,
        validate: validateEvidenceAgent,
        signal,
      });
      const evidenceOutput = evidenceRun.output;
      guardrailResults.push(evidenceRun.result);
      this.emitStage("evidence", "complete", {
        durationS: (Date.now() - t1) / 1000,
      });

      if (this.cancelled) return;

      // Extract sources pool
      const sourcesPool = extractSourcesPool(evidenceOutput);

      // --- Devil's Advocate ---
      this.emitStage("devil_advocate", "running");
      const t2 = Date.now();
      const daPrompt = isEvent
        ? prompts.devilsAdvocateEvent(title, closeDate, outcomesText, evidenceOutput, sourcesPool)
        : prompts.devilsAdvocateBinary(title, resolutionCriteria, closeDate, yesPrice, evidenceOutput, sourcesPool);

      const daRun = await this.runWithGuardrail({
        agent: "devils_advocate",
        stage: "devil_advocate",
        model: "haiku",
        prompt: daPrompt,
        allowedTools: ["WebSearch", "Bash"],
        validate: validateDevilsAdvocate,
        signal,
      });
      const daOutput = daRun.output;
      guardrailResults.push(daRun.result);
      this.emitStage("devil_advocate", "complete", {
        durationS: (Date.now() - t2) / 1000,
      });

      if (this.cancelled) return;

      // --- Resolution + Chaos (parallel) ---
      this.emitStage("resolution", "running");
      this.emitStage("chaos", "running");
      const t3 = Date.now();

      const resolutionPrompt = isEvent
        ? prompts.resolutionEvent(title, closeDate, resolutionCriteria, outcomesText, evidenceOutput, daOutput)
        : prompts.resolutionBinary(title, resolutionCriteria, closeDate, evidenceOutput, daOutput);

      const chaosPrompt = isEvent
        ? prompts.chaosEvent(title, closeDate, outcomesText, subText, evidenceOutput, daOutput)
        : prompts.chaosBinary(title, resolutionCriteria, closeDate, yesPrice, evidenceOutput, daOutput);

      const [resolutionOutput, chaosOutput] = await Promise.all([
        runAgent("sonnet", resolutionPrompt, ["WebSearch"], this.progressCallback("resolution"), signal),
        runAgent("haiku", chaosPrompt, ["WebSearch"], this.progressCallback("chaos"), signal),
      ]);

      const elapsed3 = (Date.now() - t3) / 1000;
      this.emitStage("resolution", "complete", { durationS: elapsed3 });
      this.emitStage("chaos", "complete", { durationS: elapsed3 });

      if (this.cancelled) return;

      // --- Calibrator ---
      this.emitStage("calibrator", "running");
      const t4 = Date.now();
      const calibratorPrompt = isEvent
        ? prompts.calibratorEvent(title, closeDate, outcomesText, subText, volume, evidenceOutput, daOutput, resolutionOutput, chaosOutput)
        : prompts.calibratorBinary(title, resolutionCriteria, closeDate, yesPrice, volume, evidenceOutput, daOutput, resolutionOutput, chaosOutput);

      const expectedRankings = isEvent ? (marketData as EventData).markets.length : 0;
      const sumCheck: SumCheckConfig | undefined = (() => {
        if (!isEvent) return undefined;
        const ed = marketData as EventData;
        const qualSum = ed.markets.reduce((s, m) => s + m.yesPrice, 0);
        const subSum = ed.subThresholdMarkets.reduce((s, m) => s + m.yesPrice, 0);
        const totalSum = qualSum + subSum;
        const [lo, hi] = MUTEX_DETECT_BAND;
        if (totalSum < lo || totalSum > hi) return undefined;
        return { expectedRankingSum: 1 - subSum, tolerance: MUTEX_TOLERANCE };
      })();
      const validateCalibrator = (text: string) =>
        isEvent
          ? validateCalibratorEvent(text, expectedRankings, sumCheck)
          : validateCalibratorBinary(text);

      const calibratorRun = await this.runWithGuardrail({
        agent: "calibrator",
        stage: "calibrator",
        model: "opus",
        prompt: calibratorPrompt,
        allowedTools: [],
        useMcp: true,
        validate: validateCalibrator,
        signal,
      });
      const calibratorOutput = calibratorRun.output;
      guardrailResults.push(calibratorRun.result);

      const guardrail: GuardrailReport = {
        results: guardrailResults,
        pipelineToolUsage: this.pipelineToolTotals(),
      };
      this.guardrailReport = guardrail;
      this.emitStage("calibrator", "complete", {
        durationS: (Date.now() - t4) / 1000,
      });

      // --- Save report ---
      const reportPath = saveReport(
        this.ticker,
        title,
        calibratorOutput,
        evidenceOutput,
        daOutput,
        resolutionOutput,
        chaosOutput,
        guardrail,
      );
      this.reportContent = fs.readFileSync(
        path.resolve(process.cwd(), reportPath),
        "utf-8",
      );

      this.emit({
        kind: "complete",
        runId: this.runId,
        reportPath,
      } as CompleteEvent);
    } catch (err) {
      if (this.cancelled) {
        // Emit cancellation for any running stages so the UI reflects it
        const stages: PipelineStage[] = ["fetch", "evidence", "devil_advocate", "resolution", "chaos", "calibrator"];
        for (const s of stages) {
          const ev = this.events.findLast((e) => e.kind === "stage" && (e as StageEvent).stage === s);
          if (ev && (ev as StageEvent).status === "running") {
            this.emitStage(s, "error", { detail: "Cancelled" });
          }
        }
        return;
      }
      // Find the running stage and mark it as error
      const runningStage = (["fetch", "evidence", "devil_advocate", "resolution", "chaos", "calibrator"] as PipelineStage[])
        .find((s) => {
          const ev = this.events.findLast((e) => e.kind === "stage" && (e as StageEvent).stage === s);
          return ev && (ev as StageEvent).status === "running";
        });
      this.emitStage(runningStage || "fetch", "error", {
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.running = false;
      this.signalEnd();
    }
  }
}

function extractSourcesPool(text: string): string {
  const marker = "## SOURCES POOL";
  const idx = text.indexOf(marker);
  if (idx === -1) return "";
  return text.slice(idx);
}

function saveReport(
  ticker: string,
  title: string,
  calibrator: string,
  evidence: string,
  da: string,
  resolution: string,
  chaos: string,
  guardrail?: GuardrailReport,
): string {
  const projectRoot = process.cwd();
  const resultsDir = path.join(projectRoot, "results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `${dateStr}_${timeStr}_${ticker}.md`;
  const filePath = path.join(resultsDir, filename);

  const guardrailSection = formatGuardrailSection(guardrail);

  const report = `# Analysis: ${title}
Generated: ${now.toISOString()}
Ticker: ${ticker}

${guardrailSection}## Calibrator Report
${calibrator}

## Evidence Agent
${evidence}

## Devil's Advocate
${da}

## Resolution Analysis
${resolution}

## Chaos Agent
${chaos}
`;

  fs.writeFileSync(filePath, report, "utf-8");
  return `results/${filename}`;
}

// --- Global run registry ---
// Attach to globalThis so the map survives Next.js HMR in dev mode

const globalForRuns = globalThis as unknown as { __pipelineRuns?: Map<string, PipelineRun> };
if (!globalForRuns.__pipelineRuns) {
  globalForRuns.__pipelineRuns = new Map();
}
const activeRuns = globalForRuns.__pipelineRuns;

export function getRun(runId: string): PipelineRun | undefined {
  return activeRuns.get(runId);
}

export function startRun(ticker: string): PipelineRun {
  const run = new PipelineRun(ticker);
  activeRuns.set(run.runId, run);
  run.run();
  return run;
}
