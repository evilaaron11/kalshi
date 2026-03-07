"use client";

import { useEffect, useState } from "react";
import type { MarketSummary } from "@/lib/types";
import type { RunState } from "@/lib/useAnalysis";
import ProgressStepper from "./ProgressStepper";
import OutcomeBar from "./OutcomeBar";

interface Props {
  market: MarketSummary;
  runState: RunState | null;
  onAnalyze: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

export default function MarketCard({
  market,
  runState,
  onAnalyze,
  onCancel,
  onRemove,
}: Props) {
  const isRunning =
    runState?.runId != null && !runState.complete && !runState.error;
  const isComplete = runState?.complete != null;
  const [report, setReport] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [hasReport, setHasReport] = useState(false);

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const seriesLower = (market.seriesTicker || market.ticker).toLowerCase();
  const titleSlug = slugify(market.eventTitle || market.title);
  const kalshiUrl = `https://kalshi.com/markets/${seriesLower}/${titleSlug}`;

  // Check if a report exists on disk for this ticker
  useEffect(() => {
    fetch(`/api/markets/${market.ticker}/report`, { method: "HEAD" }).then(
      (r) => setHasReport(r.ok),
      () => {},
    );
  }, [market.ticker]);

  // Mark report available when current run completes
  useEffect(() => {
    if (isComplete) setHasReport(true);
  }, [isComplete]);

  const handleViewReport = async () => {
    if (reportOpen) {
      setReportOpen(false);
      return;
    }
    if (report) {
      setReportOpen(true);
      return;
    }
    setLoadingReport(true);
    try {
      // Try current run first, fall back to latest on disk
      let resp: Response | null = null;
      if (runState?.runId) {
        resp = await fetch(`/api/analyze/${runState.runId}/report`);
      }
      if (!resp?.ok) {
        resp = await fetch(`/api/markets/${market.ticker}/report`);
      }
      if (resp.ok) {
        setReport(await resp.text());
        setReportOpen(true);
      }
    } finally {
      setLoadingReport(false);
    }
  };

  const typeLabel =
    market.marketType === "event"
      ? `EVENT \u00B7 ${market.outcomes?.length || 0} outcomes`
      : "BINARY";

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isRunning
          ? "border-blue-500/40 bg-blue-500/5"
          : isComplete
            ? "border-green-500/30 bg-green-500/5"
            : "border-neutral-800 bg-neutral-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>{typeLabel}</span>
            {isRunning && (
              <span className="text-blue-400 animate-pulse">ANALYZING</span>
            )}
            {isComplete && <span className="text-green-400">COMPLETE</span>}
          </div>
          <a
            href={kalshiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-neutral-100 leading-tight hover:text-blue-400 transition-colors"
          >
            {market.title} &#8599;
          </a>
        </div>
        {market.marketType === "binary" && (
          <div className="text-right text-sm tabular-nums whitespace-nowrap">
            <span className="text-green-400">
              YES {((market.yesPrice || 0) * 100).toFixed(0)}{"¢"}
            </span>
            <span className="text-neutral-600 mx-1">|</span>
            <span className="text-red-400">
              NO {((market.noPrice || 0) * 100).toFixed(0)}{"¢"}
            </span>
          </div>
        )}
      </div>

      {/* Meta line */}
      <div className="text-xs text-neutral-500 mb-3">
        {market.closeDate && (
          <span>
            Closes:{" "}
            {new Date(market.closeDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {market.volume > 0 && (
          <span className="ml-3">
            Vol: {market.volume.toLocaleString()}
          </span>
        )}
      </div>

      {/* Event outcome bars */}
      {market.marketType === "event" && market.outcomes && (
        <div className="space-y-1 mb-3">
          {market.outcomes.map((o) => (
            <OutcomeBar key={o.ticker} title={o.title} yesPrice={o.yesPrice} />
          ))}
          {market.subThresholdCount > 0 && (
            <div className="text-xs text-neutral-600 mt-1">
              +{market.subThresholdCount} more under 5{"¢"}
            </div>
          )}
        </div>
      )}

      {/* Progress stepper + live status */}
      {isRunning && runState && (
        <div className="mb-3 space-y-1">
          <ProgressStepper stages={runState.stages} />
          {(() => {
            // Show the latest progress detail from any running stage
            const runningStage = Object.entries(runState.stages).find(
              ([, s]) => s.status === "running",
            );
            const key = runningStage?.[0];
            const detail = key ? runState.progress[key] : undefined;
            return detail ? (
              <div className="text-xs text-neutral-500 truncate">
                {detail}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Error */}
      {runState?.error && (
        <div className="text-xs text-red-400 mb-3">{runState.error}</div>
      )}

      {/* Report viewer */}
      {reportOpen && report && (
        <div className="mb-3 border border-neutral-700 rounded bg-neutral-950 max-h-[600px] overflow-y-auto">
          <pre className="p-4 text-xs text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
            {report}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onRemove}
          className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
        >
          Remove
        </button>
        {hasReport && (
          <button
            onClick={handleViewReport}
            disabled={loadingReport}
            className="px-3 py-1 text-xs bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
          >
            {loadingReport ? "Loading..." : reportOpen ? "Hide Report" : "View Report"}
          </button>
        )}
        {isRunning ? (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={onAnalyze}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            {isComplete ? "Re-run \u25B6" : "Analyze \u25B6"}
          </button>
        )}
      </div>
    </div>
  );
}
