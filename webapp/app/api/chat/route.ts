import { spawn } from "child_process";
import fs from "fs";
import path from "path";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function loadLatestReport(ticker: string): string | null {
  const resultsDir = path.resolve(process.cwd(), "..", "results");
  if (!fs.existsSync(resultsDir)) return null;

  const files = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith(`_${ticker.toUpperCase()}.md`))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return fs.readFileSync(path.join(resultsDir, files[0]), "utf-8");
}

function buildPrompt(reportText: string, messages: ChatMessage[]): string {
  const history = messages.slice(0, -1).map((m) =>
    `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
  ).join("\n\n");

  const latest = messages[messages.length - 1];

  return `You are a helpful analyst assistant. The user is viewing a prediction market analysis report and has questions about it.

<report>
${reportText}
</report>

${history ? `Previous conversation:\n${history}\n\n` : ""}User: ${latest.content}

Answer concisely based on the report. Reference specific data, probabilities, and reasoning from the report when relevant. If the user asks about something not covered in the report, say so.`;
}

export async function POST(request: Request) {
  const { messages, ticker } = (await request.json()) as {
    messages: ChatMessage[];
    ticker: string;
  };

  if (!messages?.length || !ticker) {
    return new Response(JSON.stringify({ error: "messages and ticker required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reportText = loadLatestReport(ticker);
  if (!reportText) {
    return new Response(JSON.stringify({ error: "No report found for this ticker" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = buildPrompt(reportText, messages);

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

            // Extract text content from assistant message blocks
            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: block.text })}\n\n`)
                  );
                }
              }
            }

            // Final result
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

      // Handle client disconnect
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
