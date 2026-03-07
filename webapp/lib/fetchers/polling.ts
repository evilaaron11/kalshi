import { getJson, getText } from "../httpClient";
import { WIKIPEDIA_API, RCP_LATEST, RCP_REQUEST_TIMEOUT } from "../config";
import { BROWSER_HEADERS } from "../config";
import { matchesQuery, stripHtml } from "../textUtils";
import * as cheerio from "cheerio";

interface PollingResult {
  race: string;
  sourceName: string;
  url: string;
  columns?: string[];
  polls?: Record<string, string>[];
  data?: string;
}

async function wikipediaSearch(query: string): Promise<{ title: string }[]> {
  const data = await getJson<{ query: { search: { title: string }[] } }>(
    WIKIPEDIA_API,
    {
      params: {
        action: "query",
        list: "search",
        srsearch: `polling ${query}`,
        srlimit: "5",
        format: "json",
      },
    },
  );
  return data?.query?.search || [];
}

async function fetchWikipediaPolling(
  title: string,
): Promise<PollingResult[]> {
  const html = await getText(
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    { headers: BROWSER_HEADERS },
  );
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: PollingResult[] = [];

  $("table.wikitable").each((_, table) => {
    const headerText = $(table).find("th").first().text().toLowerCase();
    if (!headerText.includes("poll")) return;

    const columns: string[] = [];
    $(table)
      .find("tr")
      .first()
      .find("th")
      .each((__, th) => { columns.push($(th).text().trim()); });

    const rows: Record<string, string>[] = [];
    $(table)
      .find("tr")
      .slice(1, 11) // First 10 data rows
      .each((__, tr) => {
        const row: Record<string, string> = {};
        $(tr)
          .find("td, th")
          .each((i, cell) => {
            if (columns[i]) row[columns[i]] = $(cell).text().trim();
          });
        if (Object.keys(row).length > 0) rows.push(row);
      });

    if (rows.length > 0) {
      results.push({
        race: title.replace(/_/g, " "),
        sourceName: "Wikipedia",
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        columns,
        polls: rows,
      });
    }
  });

  return results;
}

async function fetchRcp(raceFilter = ""): Promise<PollingResult[]> {
  const html = await getText(RCP_LATEST, {
    headers: BROWSER_HEADERS,
    timeout: RCP_REQUEST_TIMEOUT,
  });
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: PollingResult[] = [];

  $("tr[data-id]").each((_, tr) => {
    const raceName = $(tr).find("td").first().text().trim();
    const link = $(tr).find("a").attr("href") || "";
    if (!matchesQuery(raceName, raceFilter)) return;
    results.push({
      race: raceName,
      sourceName: "RealClearPolitics",
      url: link.startsWith("http")
        ? link
        : `https://www.realclearpolitics.com${link}`,
    });
  });

  return results;
}

export async function fetchPolling(opts: {
  race: string;
  source?: "wikipedia" | "rcp" | "both";
}): Promise<PollingResult[]> {
  const src = opts.source || "both";
  const promises: Promise<PollingResult[]>[] = [];

  if (src === "wikipedia" || src === "both") {
    promises.push(
      wikipediaSearch(opts.race).then(async (hits) => {
        const all: PollingResult[] = [];
        for (const h of hits.slice(0, 3)) {
          all.push(...(await fetchWikipediaPolling(h.title)));
        }
        return all;
      }),
    );
  }
  if (src === "rcp" || src === "both") {
    promises.push(fetchRcp(opts.race));
  }

  const arrays = await Promise.all(promises);
  return arrays.flat();
}
