import { getText } from "../httpClient";
import {
  WHITEHOUSE_FEEDS,
  WHITEHOUSE_MAX_FEED_ITEMS,
  WHITEHOUSE_MAX_TEXT_CHARS,
  WHITEHOUSE_REQUEST_DELAY,
  BROWSER_HEADERS,
} from "../config";
import { matchesQuery } from "../textUtils";
import * as cheerio from "cheerio";
import Parser from "rss-parser";

interface WhiteHouseItem {
  title: string;
  url: string;
  published: string;
  type: string;
  text: string;
}

const rssParser = new Parser();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPageText(url: string): Promise<string> {
  const html = await getText(url, { headers: BROWSER_HEADERS });
  if (!html) return "";

  const $ = cheerio.load(html);

  // Remove non-content elements
  $("nav, header, footer, script, style, aside").remove();

  // Try content selectors in order of specificity
  const selectors = [
    ".body-content",
    ".entry-content",
    ".page-content",
    ".wp-block-group",
    "article",
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().replace(/\s+/g, " ").trim();
      if (text.length > 100) return text.slice(0, WHITEHOUSE_MAX_TEXT_CHARS);
    }
  }

  // Fallback: all <p> tags
  const paragraphs: string[] = [];
  $("p").each((_, el) => { paragraphs.push($(el).text().trim()); });
  return paragraphs.join("\n\n").slice(0, WHITEHOUSE_MAX_TEXT_CHARS);
}

export async function fetchWhiteHouse(opts: {
  query?: string;
  type?: "eos" | "briefings" | "statements" | "all";
  limit?: number;
}): Promise<WhiteHouseItem[]> {
  const feedType = opts.type || "all";
  const limit = opts.limit || 5;
  const feedKeys =
    feedType === "all" ? Object.keys(WHITEHOUSE_FEEDS) : [feedType];

  const results: WhiteHouseItem[] = [];

  for (const key of feedKeys) {
    const feedUrl = WHITEHOUSE_FEEDS[key];
    if (!feedUrl) continue;

    let feed;
    try {
      feed = await rssParser.parseURL(feedUrl);
    } catch {
      continue;
    }

    const items = (feed.items || []).slice(0, WHITEHOUSE_MAX_FEED_ITEMS);

    for (const item of items) {
      const title = item.title || "";
      const summary = item.contentSnippet || item.content || "";

      if (opts.query && !matchesQuery(`${title} ${summary}`, opts.query))
        continue;

      const url = item.link || "";
      await sleep(WHITEHOUSE_REQUEST_DELAY);
      const text = await fetchPageText(url);

      results.push({
        title,
        url,
        published: item.pubDate || item.isoDate || "",
        type: key,
        text,
      });

      if (results.length >= limit) return results;
    }
  }

  return results;
}
