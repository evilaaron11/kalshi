import { NextRequest, NextResponse } from "next/server";
import { loadWatchlist, addToWatchlist } from "@/lib/watchlist";
import { fetchMarket, parseTicker } from "@/lib/kalshi";
import { isEventData } from "@/lib/types";
import type { MarketSummary } from "@/lib/types";

export async function GET() {
  const tickers = loadWatchlist();
  const results: MarketSummary[] = [];

  for (const ticker of tickers) {
    try {
      const data = await fetchMarket(ticker);
      if (isEventData(data)) {
        const first = data.markets[0];
        results.push({
          ticker,
          title: data.title,
          marketType: "event",
          volume: data.markets.reduce((s, m) => s + m.volume, 0),
          closeDate: first?.closeDate || "",
          status: first?.status || "",
          seriesTicker: data.seriesTicker,
          eventTitle: data.eventTitle,
          outcomes: data.markets.map((m) => ({
            ticker: m.ticker,
            title: m.yesSubTitle || m.subtitle || m.title,
            yesPrice: m.yesPrice,
          })),
          subThresholdCount: data.subThresholdMarkets.length,
        });
      } else {
        results.push({
          ticker,
          title: data.title,
          marketType: "binary",
          yesPrice: data.yesPrice,
          noPrice: data.noPrice,
          volume: data.volume,
          closeDate: data.closeDate,
          status: data.status,
          seriesTicker: data.seriesTicker,
          eventTitle: data.eventTitle,
          subThresholdCount: 0,
        });
      }
    } catch (e) {
      results.push({
        ticker,
        title: `${ticker} (fetch error: ${e instanceof Error ? e.message : String(e)})`,
        marketType: "binary",
        volume: 0,
        closeDate: "",
        status: "",
        subThresholdCount: 0,
      });
    }
  }

  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = body.url as string;
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const ticker = parseTicker(url);
    const tickers = addToWatchlist(ticker);
    return NextResponse.json({ ticker, watchlist: tickers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
