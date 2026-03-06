"""Pydantic models for the Kalshi Analyst API."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class MarketType(str, Enum):
    BINARY = "binary"
    EVENT = "event"


class PipelineStage(str, Enum):
    FETCH = "fetch"
    EVIDENCE = "evidence"
    DEVIL_ADVOCATE = "devil_advocate"
    RESOLUTION = "resolution"
    CHAOS = "chaos"
    CALIBRATOR = "calibrator"


class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    ERROR = "error"


# --- Request / Response ---

class AddMarketRequest(BaseModel):
    url: str


class AnalyzeRequest(BaseModel):
    ticker: str


class MarketSummary(BaseModel):
    ticker: str
    title: str
    market_type: MarketType
    yes_price: float | None = None
    no_price: float | None = None
    volume: int = 0
    close_date: str = ""
    status: str = ""
    # Event-specific
    outcomes: list[OutcomeSummary] | None = None
    sub_threshold_count: int = 0


class OutcomeSummary(BaseModel):
    ticker: str
    title: str
    yes_price: float | None = None


class RunInfo(BaseModel):
    run_id: str
    ticker: str
    started_at: datetime


# --- SSE events ---

class StageEvent(BaseModel):
    stage: PipelineStage
    status: StageStatus
    duration_s: float | None = None
    detail: str | None = None


class CompleteEvent(BaseModel):
    run_id: str
    report_path: str


# Allow forward ref for outcomes inside MarketSummary
MarketSummary.model_rebuild()
