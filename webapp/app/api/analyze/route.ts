import { NextRequest, NextResponse } from "next/server";
import { startRun } from "@/lib/pipeline";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const ticker = (body.ticker as string)?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const run = startRun(ticker);
  return NextResponse.json({
    runId: run.runId,
    ticker: run.ticker,
    startedAt: new Date().toISOString(),
  });
}
