import { getRun } from "@/lib/pipeline";
import type { PipelineEvent } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send any events that already happened
      for (const event of run.events) {
        const eventType = event.kind;
        controller.enqueue(
          encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      }

      // If already finished, close
      if (!run.isRunning() && run.events.some((e) => e.kind === "complete")) {
        controller.close();
        return;
      }

      // Subscribe to new events
      const unsubscribe = run.subscribe((event: PipelineEvent | null) => {
        if (event === null) {
          controller.close();
          return;
        }
        const eventType = event.kind;
        controller.enqueue(
          encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      });

      // Cleanup on cancel
      _request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
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
