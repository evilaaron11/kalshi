import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fetchMarket } from "./kalshi";
import type {
  MarketData,
  ParsedMarket,
  EventData,
  PipelineEvent,
  PipelineStage,
  StageEvent,
  ProgressEvent,
  CompleteEvent,
} from "./types";
import { isEventData } from "./types";
import * as prompts from "./prompts";

// --- Claude CLI runner ---

/**
 * Run a Claude Code agent as a subprocess using the user's Max subscription.
 * Uses `claude -p --model <model> --output-format stream-json` for real-time progress.
 * Calls onProgress with human-readable status updates as the agent works.
 */
async function runAgent(
  model: "haiku" | "sonnet" | "opus",
  prompt: string,
  allowedTools: string[] = ["WebSearch", "Bash"],
  onProgress?: (detail: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--model", model,
      "--output-format", "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--dangerously-skip-permissions",
    ];

    if (allowedTools.length > 0) {
      args.push("--allowedTools", ...allowedTools);
    } else {
      args.push("--disallowedTools", "Bash", "WebSearch", "Read", "Edit", "Write", "Glob", "Grep");
    }

    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.resolve(process.cwd(), ".."),
      env,
      shell: true,
    });

    let buffer = "";
    let resultText = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      // Parse newline-delimited JSON
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          // Extract progress info from streaming events
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "tool_use" && onProgress) {
                const toolName = block.name || "tool";
                const input = block.input || {};
                // Summarize tool calls for the UI
                if (toolName === "WebSearch" || toolName === "web_search") {
                  onProgress(`Searching: ${input.query || "..."}`);
                } else if (toolName === "Bash") {
                  const cmd = (input.command || "").slice(0, 80);
                  onProgress(`Running: ${cmd}`);
                } else {
                  onProgress(`Using ${toolName}...`);
                }
              }
            }
          }
          // Capture the final result
          if (event.type === "result") {
            resultText = event.result || "";
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && resultText) {
        resolve(resultText);
      } else if (code === 0) {
        // Fallback: no result event found, shouldn't happen
        resolve(buffer.trim());
      } else {
        reject(new Error(`Claude agent exited with code ${code}: ${stderr.slice(0, 500)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

// --- Pipeline run ---

export class PipelineRun {
  runId: string;
  ticker: string;
  events: PipelineEvent[] = [];
  reportContent: string | null = null;
  private listeners: ((event: PipelineEvent | null) => void)[] = [];
  private cancelled = false;
  private running = false;

  constructor(ticker: string) {
    this.runId = Math.random().toString(36).slice(2, 14);
    this.ticker = ticker;
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

  private emitProgress(stage: PipelineStage, detail: string) {
    this.emit({ kind: "progress", stage, detail } as ProgressEvent);
  }

  private progressCallback(stage: PipelineStage) {
    return (detail: string) => this.emitProgress(stage, detail);
  }

  subscribe(fn: (event: PipelineEvent | null) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  cancel() {
    this.cancelled = true;
  }

  isRunning() {
    return this.running;
  }

  private signalEnd() {
    for (const listener of this.listeners) listener(null);
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

      // --- Evidence ---
      this.emitStage("evidence", "running");
      const t1 = Date.now();
      const evidencePrompt = isEvent
        ? prompts.evidenceEvent(title, closeDate, resolutionCriteria, outcomesText)
        : prompts.evidenceBinary(title, resolutionCriteria, closeDate, yesPrice);

      const evidenceOutput = await runAgent("haiku", evidencePrompt, ["WebSearch", "Bash"], this.progressCallback("evidence"));
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

      const daOutput = await runAgent("haiku", daPrompt, ["WebSearch", "Bash"], this.progressCallback("devil_advocate"));
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
        runAgent("sonnet", resolutionPrompt, ["WebSearch"], this.progressCallback("resolution")),
        runAgent("haiku", chaosPrompt, ["WebSearch"], this.progressCallback("chaos")),
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

      const calibratorOutput = await runAgent("sonnet", calibratorPrompt, [], this.progressCallback("calibrator"));
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
      );
      this.reportContent = fs.readFileSync(
        path.resolve(process.cwd(), "..", reportPath),
        "utf-8",
      );

      this.emit({
        kind: "complete",
        runId: this.runId,
        reportPath,
      } as CompleteEvent);
    } catch (err) {
      this.emitStage("fetch", "error", {
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
): string {
  const projectRoot = path.resolve(process.cwd(), "..");
  const resultsDir = path.join(projectRoot, "results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `${dateStr}_${timeStr}_${ticker}.md`;
  const filePath = path.join(resultsDir, filename);

  const report = `# Analysis: ${title}
Generated: ${now.toISOString()}
Ticker: ${ticker}

## Calibrator Report
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
