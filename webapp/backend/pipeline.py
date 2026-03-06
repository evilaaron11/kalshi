"""Pipeline orchestrator — runs the multi-agent analysis and emits SSE events."""

from __future__ import annotations

import asyncio
import sys
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator

from .models import CompleteEvent, PipelineStage, StageEvent, StageStatus

# Add project root so we can import kalshi_client, fetchers, etc.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class PipelineRun:
    """Tracks a single analysis run and streams SSE events."""

    def __init__(self, ticker: str):
        self.run_id = uuid.uuid4().hex[:12]
        self.ticker = ticker
        self.events: asyncio.Queue[StageEvent | CompleteEvent | None] = asyncio.Queue()
        self._task: asyncio.Task | None = None
        self._cancelled = False

    async def emit(self, event: StageEvent | CompleteEvent):
        await self.events.put(event)

    async def emit_stage(
        self, stage: PipelineStage, status: StageStatus, **kwargs
    ):
        await self.emit(StageEvent(stage=stage, status=status, **kwargs))

    def cancel(self):
        self._cancelled = True
        if self._task:
            self._task.cancel()

    async def run(self):
        """Execute the full pipeline, emitting events at each stage."""
        try:
            # --- Stage: Fetch ---
            await self.emit_stage(PipelineStage.FETCH, StageStatus.RUNNING)
            t0 = time.time()
            market_data = await self._fetch_market()
            await self.emit_stage(
                PipelineStage.FETCH, StageStatus.COMPLETE,
                duration_s=round(time.time() - t0, 1),
            )

            if self._cancelled:
                return

            # --- Stage: Evidence ---
            await self.emit_stage(PipelineStage.EVIDENCE, StageStatus.RUNNING)
            t0 = time.time()
            evidence_output = await self._run_evidence(market_data)
            await self.emit_stage(
                PipelineStage.EVIDENCE, StageStatus.COMPLETE,
                duration_s=round(time.time() - t0, 1),
            )

            if self._cancelled:
                return

            # --- Stage: Devil's Advocate ---
            await self.emit_stage(PipelineStage.DEVIL_ADVOCATE, StageStatus.RUNNING)
            t0 = time.time()
            da_output = await self._run_devils_advocate(market_data, evidence_output)
            await self.emit_stage(
                PipelineStage.DEVIL_ADVOCATE, StageStatus.COMPLETE,
                duration_s=round(time.time() - t0, 1),
            )

            if self._cancelled:
                return

            # --- Stages: Resolution + Chaos (parallel) ---
            await self.emit_stage(PipelineStage.RESOLUTION, StageStatus.RUNNING)
            await self.emit_stage(PipelineStage.CHAOS, StageStatus.RUNNING)
            t0 = time.time()

            resolution_output, chaos_output = await asyncio.gather(
                self._run_resolution(market_data, evidence_output, da_output),
                self._run_chaos(market_data, evidence_output, da_output),
            )

            elapsed = round(time.time() - t0, 1)
            await self.emit_stage(
                PipelineStage.RESOLUTION, StageStatus.COMPLETE, duration_s=elapsed,
            )
            await self.emit_stage(
                PipelineStage.CHAOS, StageStatus.COMPLETE, duration_s=elapsed,
            )

            if self._cancelled:
                return

            # --- Stage: Calibrator ---
            await self.emit_stage(PipelineStage.CALIBRATOR, StageStatus.RUNNING)
            t0 = time.time()
            calibrator_output = await self._run_calibrator(
                market_data, evidence_output, da_output,
                resolution_output, chaos_output,
            )
            await self.emit_stage(
                PipelineStage.CALIBRATOR, StageStatus.COMPLETE,
                duration_s=round(time.time() - t0, 1),
            )

            # --- Save report ---
            report_path = await self._save_report(
                market_data, evidence_output, da_output,
                resolution_output, chaos_output, calibrator_output,
            )

            await self.emit(CompleteEvent(run_id=self.run_id, report_path=report_path))

        except asyncio.CancelledError:
            pass
        except Exception as e:
            # Emit error on whatever stage was running
            await self.emit(StageEvent(
                stage=PipelineStage.FETCH,
                status=StageStatus.ERROR,
                detail=str(e),
            ))
        finally:
            await self.events.put(None)  # Signal stream end

    # --- Stage implementations (stubs for now — will integrate Agent SDK) ---

    async def _fetch_market(self) -> dict:
        """Fetch market data from Kalshi API."""
        import kalshi_client
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, kalshi_client.fetch_market, self.ticker)

    async def _run_evidence(self, market_data: dict) -> str:
        # TODO: integrate Claude Agent SDK
        await asyncio.sleep(0.5)  # placeholder
        return "[Evidence agent output placeholder]"

    async def _run_devils_advocate(self, market_data: dict, evidence: str) -> str:
        await asyncio.sleep(0.5)
        return "[Devil's Advocate output placeholder]"

    async def _run_resolution(self, market_data: dict, evidence: str, da: str) -> str:
        await asyncio.sleep(0.5)
        return "[Resolution agent output placeholder]"

    async def _run_chaos(self, market_data: dict, evidence: str, da: str) -> str:
        await asyncio.sleep(0.5)
        return "[Chaos agent output placeholder]"

    async def _run_calibrator(
        self, market_data: dict, evidence: str, da: str,
        resolution: str, chaos: str,
    ) -> str:
        await asyncio.sleep(0.5)
        return "[Calibrator output placeholder]"

    async def _save_report(
        self, market_data: dict, evidence: str, da: str,
        resolution: str, chaos: str, calibrator: str,
    ) -> str:
        """Save report to results/ directory and return the path."""
        from datetime import datetime

        results_dir = PROJECT_ROOT / "results"
        results_dir.mkdir(exist_ok=True)

        now = datetime.now()
        filename = f"{now.strftime('%Y-%m-%d_%H%M')}_{self.ticker}.md"
        path = results_dir / filename

        report = f"""# Analysis: {market_data.get('title', self.ticker)}
Generated: {now.isoformat()}
Ticker: {self.ticker}

## Calibrator Report
{calibrator}

## Evidence Agent
{evidence}

## Devil's Advocate
{da}

## Resolution Analysis
{resolution}

## Chaos Agent
{chaos}
"""
        path.write_text(report, encoding="utf-8")
        return str(path.relative_to(PROJECT_ROOT))


# Global registry of active runs
_active_runs: dict[str, PipelineRun] = {}


def get_run(run_id: str) -> PipelineRun | None:
    return _active_runs.get(run_id)


async def start_run(ticker: str) -> PipelineRun:
    run = PipelineRun(ticker)
    _active_runs[run.run_id] = run
    run._task = asyncio.create_task(run.run())
    return run


async def event_stream(run: PipelineRun) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted strings from a pipeline run."""
    while True:
        event = await run.events.get()
        if event is None:
            break
        if isinstance(event, StageEvent):
            yield f"event: stage\ndata: {event.model_dump_json()}\n\n"
        elif isinstance(event, CompleteEvent):
            yield f"event: complete\ndata: {event.model_dump_json()}\n\n"
