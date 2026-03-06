"""FastAPI backend for Kalshi Analyst web app."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import add_to_watchlist, load_watchlist, remove_from_watchlist
from .models import (
    AddMarketRequest,
    AnalyzeRequest,
    MarketSummary,
    MarketType,
    OutcomeSummary,
    RunInfo,
)
from .pipeline import event_stream, get_run, start_run

app = FastAPI(title="Kalshi Analyst", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _market_data_to_summary(ticker: str, data: dict) -> MarketSummary:
    """Convert raw kalshi_client data to a MarketSummary."""
    if data.get("type") == "event":
        markets = data.get("markets", [])
        sub = data.get("sub_threshold_markets", [])
        first = markets[0] if markets else {}
        return MarketSummary(
            ticker=ticker,
            title=first.get("title", ticker),
            market_type=MarketType.EVENT,
            volume=sum(m.get("volume", 0) for m in markets),
            close_date=first.get("close_date", ""),
            status=first.get("status", ""),
            outcomes=[
                OutcomeSummary(
                    ticker=m["ticker"], title=m["title"], yes_price=m.get("yes_price")
                )
                for m in markets
            ],
            sub_threshold_count=len(sub),
        )
    return MarketSummary(
        ticker=data.get("ticker", ticker),
        title=data.get("title", ticker),
        market_type=MarketType.BINARY,
        yes_price=data.get("yes_price"),
        no_price=data.get("no_price"),
        volume=data.get("volume", 0),
        close_date=data.get("close_date", ""),
        status=data.get("status", ""),
    )


@app.get("/api/markets", response_model=list[MarketSummary])
async def list_markets():
    """Return curated market list with current Kalshi prices."""
    import kalshi_client

    tickers = load_watchlist()
    results = []
    for ticker in tickers:
        try:
            parsed = kalshi_client.parse_ticker(ticker)
            data = kalshi_client.fetch_market(parsed)
            results.append(_market_data_to_summary(parsed, data))
        except Exception as e:
            # Return a stub so the frontend knows about the ticker even if fetch failed
            results.append(
                MarketSummary(
                    ticker=ticker,
                    title=f"{ticker} (fetch error: {e})",
                    market_type=MarketType.BINARY,
                )
            )
    return results


@app.post("/api/markets")
async def add_market(req: AddMarketRequest):
    """Add a market URL/ticker to the watchlist."""
    import kalshi_client

    try:
        ticker = kalshi_client.parse_ticker(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    tickers = add_to_watchlist(ticker)
    return {"ticker": ticker, "watchlist": tickers}


@app.delete("/api/markets/{ticker}")
async def delete_market(ticker: str):
    """Remove a market from the watchlist."""
    tickers = remove_from_watchlist(ticker.upper())
    return {"watchlist": tickers}


@app.post("/api/analyze", response_model=RunInfo)
async def analyze(req: AnalyzeRequest):
    """Kick off the analysis pipeline for a market."""
    from datetime import datetime

    run = await start_run(req.ticker.upper())
    return RunInfo(
        run_id=run.run_id,
        ticker=run.ticker,
        started_at=datetime.now(),
    )


@app.get("/api/analyze/{run_id}/sse")
async def analyze_sse(run_id: str):
    """SSE stream of pipeline progress events."""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return StreamingResponse(
        event_stream(run),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/analyze/{run_id}/cancel")
async def cancel_run(run_id: str):
    """Cancel a running analysis."""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.cancel()
    return {"status": "cancelled"}


@app.get("/api/reports/{run_id}")
async def get_report(run_id: str):
    """Retrieve a completed report."""
    # TODO: store run_id -> report_path mapping
    raise HTTPException(status_code=501, detail="Not yet implemented")
