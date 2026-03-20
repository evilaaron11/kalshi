import fs from "fs";
import path from "path";

function getReportFiles(ticker: string): string[] {
  const resultsDir = path.resolve(process.cwd(), "results");
  if (!fs.existsSync(resultsDir)) return [];
  return fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith(`_${ticker.toUpperCase()}.md`))
    .sort()
    .reverse(); // newest first
}

function parseFilename(filename: string): { date: string; time: string } {
  // Format: YYYY-MM-DD_HHMM_TICKER.md
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(\d{4})_/);
  if (!match) return { date: "", time: "" };
  return { date: match[1], time: `${match[2].slice(0, 2)}:${match[2].slice(2)}` };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const url = new URL(request.url);
  const listAll = url.searchParams.get("all") === "true";
  const specificFile = url.searchParams.get("file");

  const files = getReportFiles(ticker);
  if (files.length === 0) {
    return new Response("No report for this ticker", { status: 404 });
  }

  const resultsDir = path.resolve(process.cwd(), "results");

  // List all reports for this ticker
  if (listAll) {
    const reports = files.map((f) => {
      const { date, time } = parseFilename(f);
      return { filename: f, date, time };
    });
    return Response.json(reports);
  }

  // Return a specific report by filename
  const target = specificFile || files[0];
  if (!files.includes(target)) {
    return new Response("Report not found", { status: 404 });
  }

  const content = fs.readFileSync(path.join(resultsDir, target), "utf-8");
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
