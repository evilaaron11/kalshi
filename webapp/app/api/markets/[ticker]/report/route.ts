import fs from "fs";
import path from "path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const resultsDir = path.resolve(process.cwd(), "..", "results");

  if (!fs.existsSync(resultsDir)) {
    return new Response("No reports found", { status: 404 });
  }

  // Find the latest report file matching this ticker
  const files = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith(`_${ticker.toUpperCase()}.md`))
    .sort()
    .reverse();

  if (files.length === 0) {
    return new Response("No report for this ticker", { status: 404 });
  }

  const content = fs.readFileSync(path.join(resultsDir, files[0]), "utf-8");
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
