import * as cheerio from "cheerio";

/** Strip HTML tags, returning plain text. */
export function stripHtml(html: string): string {
  try {
    const $ = cheerio.load(html);
    return $.text().replace(/\s+/g, " ").trim();
  } catch {
    return html;
  }
}

/** Return true if `text` is relevant to `query` (fuzzy keyword match). */
export function matchesQuery(text: string, query: string): boolean {
  if (!query.trim()) return true;

  const lower = text.toLowerCase();
  const q = query.toLowerCase();

  // Exact substring
  if (lower.includes(q)) return true;

  // Word-level matching: words longer than 3 chars
  const words = q.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return lower.includes(q);

  const hits = words.filter((w) => lower.includes(w)).length;
  return words.length === 1 ? hits >= 1 : hits >= 2;
}
