import { NextResponse } from "next/server";
import { removeFromWatchlist } from "@/lib/watchlist";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const tickers = removeFromWatchlist(ticker.toUpperCase());
  return NextResponse.json({ watchlist: tickers });
}
