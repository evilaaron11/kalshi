import { NextResponse } from "next/server";
import { getRun } from "@/lib/pipeline";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  run.cancel();
  return NextResponse.json({ status: "cancelled" });
}
