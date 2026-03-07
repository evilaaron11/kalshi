import { getRun } from "@/lib/pipeline";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  if (!run.reportContent) {
    return new Response("Report not ready", { status: 404 });
  }

  return new Response(run.reportContent, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
