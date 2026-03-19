import { spawn } from "child_process";
import fs from "fs";
import path from "path";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function loadLatestReport(ticker: string): { ticker: string; content: string } | null {
  const resultsDir = path.resolve(process.cwd(), "..", "results");
  if (!fs.existsSync(resultsDir)) return null;

  const files = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith(`_${ticker.toUpperCase()}.md`))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return {
    ticker,
    content: fs.readFileSync(path.join(resultsDir, files[0]), "utf-8"),
  };
}

function buildPrompt(reports: { ticker: string; content: string }[], messages: ChatMessage[]): string {
  const reportsBlock = reports.map((r) =>
    `<report ticker="${r.ticker}">\n${r.content}\n</report>`
  ).join("\n\n");

  const history = messages.slice(0, -1).map((m) =>
    `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
  ).join("\n\n");

  const latest = messages[messages.length - 1];

  return `You are a helpful analyst assistant. The user is viewing prediction market analysis reports and has questions about them.

${reports.length === 1 ? "Here is the analysis report:" : `Here are ${reports.length} analysis reports:`}

${reportsBlock}

${history ? `Previous conversation:\n${history}\n\n` : ""}User: ${latest.content}

Answer concisely based on the reports. Reference specific data, probabilities, and reasoning when relevant. If the user asks about a specific market, find it by name or ticker. If the user asks about something not covered, say so.`;
}

export async function POST(request: Request) {
  const { messages, tickers } = (await request.json()) as {
    messages: ChatMessage[];
    tickers: string[];
  };

  if (!messages?.length || !tickers?.length) {
    return new Response(JSON.stringify({ error: "messages and tickers required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load all available reports
  const reports = tickers
    .map((t) => loadLatestReport(t))
    .filter((r): r is { ticker: string; content: string } => r !== null);

  if (reports.length === 0) {
    return new Response(JSON.stringify({ error: "No reports found. Run an analysis first." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = buildPrompt(reports, messages);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const args = [
        "-p",
        "--model", "sonnet",
        "--output-format", "stream-json",
        "--no-session-persistence",
        "--dangerously-skip-permissions",
        "--disallowedTools", "Bash", "WebSearch", "Read", "Edit", "Write", "Glob", "Grep",
      ];

      const env = { ...process.env };
      delete env.CLAUDECODE;

      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: path.resolve(process.cwd(), ".."),
        env,
        shell: true,
      });

      let buffer = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: block.text })}\n\n`)
                  );
                }
              }
            }

            if (event.type === "result" && event.result) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done", text: event.result })}\n\n`)
              );
            }
          } catch {
            // skip malformed
          }
        }
      });

      proc.on("close", () => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "end" })}\n\n`));
        controller.close();
      });

      proc.on("error", (err) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`)
        );
        controller.close();
      });

      request.signal.addEventListener("abort", () => {
        proc.kill();
      });

      proc.stdin.write(prompt);
      proc.stdin.end();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
