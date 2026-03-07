import { getJson } from "../httpClient";
import {
  POLYMARKET_API_BASE,
  POLYMARKET_REQUEST_TIMEOUT,
  POLYMARKET_SEARCH_LIMIT,
  METACULUS_API_BASE,
  METACULUS_REQUEST_TIMEOUT,
  METACULUS_SEARCH_LIMIT,
} from "../config";
import type { CrossMarketResult } from "../types";

export async function searchPolymarket(
  query: string,
  limit = POLYMARKET_SEARCH_LIMIT,
): Promise<CrossMarketResult[]> {
  const data = await getJson<Record<string, unknown[]>>(
    `${POLYMARKET_API_BASE}/public-search`,
    {
      params: { q: query, limit_per_type: String(limit) },
      timeout: POLYMARKET_REQUEST_TIMEOUT,
    },
  );
  if (!data) return [];

  const results: CrossMarketResult[] = [];
  const events = (data.events || []) as Record<string, unknown>[];

  for (const event of events) {
    const markets = (event.markets || []) as Record<string, unknown>[];
    for (const m of markets) {
      if (m.closed === true || m.archived === true) continue;
      let probability = 0;
      try {
        const prices = JSON.parse((m.outcomePrices as string) || "[]") as string[];
        probability = parseFloat(prices[0] || "0");
      } catch {
        continue;
      }
      results.push({
        platform: "polymarket",
        title: (m.question as string) || (event.title as string) || "",
        probability,
        volume: m.volume_num_24hr as number | undefined,
        url: `https://polymarket.com/event/${event.slug}`,
      });
    }
  }

  return results.slice(0, limit);
}

export async function searchMetaculus(
  query: string,
  limit = METACULUS_SEARCH_LIMIT,
): Promise<CrossMarketResult[]> {
  const token = process.env.METACULUS_TOKEN;
  if (!token) return [];

  const data = await getJson<{ results: Record<string, unknown>[] }>(
    `${METACULUS_API_BASE}/posts/`,
    {
      params: {
        search: query,
        statuses: "open",
        forecast_type: "binary",
        limit: String(limit),
        order_by: "-hotness",
        with_cp: "true",
      },
      headers: { Authorization: `Token ${token}` },
      timeout: METACULUS_REQUEST_TIMEOUT,
    },
  );
  if (!data?.results) return [];

  const results: CrossMarketResult[] = [];
  for (const post of data.results) {
    const q = post.question as Record<string, unknown> | undefined;
    if (!q) continue;

    let probability = 0;
    try {
      const agg = q.aggregations as Record<string, unknown>;
      const rw = agg?.recency_weighted as Record<string, unknown>;
      const latest = rw?.latest as Record<string, unknown>;
      const centers = latest?.centers as number[];
      probability = centers?.[0] || 0;
    } catch {
      continue;
    }

    results.push({
      platform: "metaculus",
      title: (post.title as string) || "",
      probability,
      forecasters: q.forecasters_count as number | undefined,
      url: `https://www.metaculus.com/questions/${post.id}/`,
    });
  }

  return results;
}

export async function searchCrossMarket(
  query: string,
  platforms: string[] = ["polymarket", "metaculus"],
  limit = 5,
): Promise<CrossMarketResult[]> {
  const promises: Promise<CrossMarketResult[]>[] = [];
  if (platforms.includes("polymarket")) {
    promises.push(searchPolymarket(query, limit));
  }
  if (platforms.includes("metaculus")) {
    promises.push(searchMetaculus(query, limit));
  }
  const arrays = await Promise.all(promises);
  return arrays.flat();
}
