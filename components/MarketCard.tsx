"use client";

import { useEffect, useState } from "react";
import type { MarketSummary } from "@/lib/types";
import type { RunState } from "@/lib/useAnalysis";
import type { ParsedReport } from "@/lib/reportParser";
import { parseReport } from "@/lib/reportParser";
import ProgressStepper from "./ProgressStepper";
import OutcomeBar from "./OutcomeBar";
import ReportViewer from "./ReportViewer";

interface ReportEntry {
  filename: string;
  date: string;
  time: string;
}

interface Props {
  market: MarketSummary;
  runState: RunState | null;
  onAnalyze: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onReportToggle?: (open: boolean) => void;
}

export default function MarketCard({
  market,
  runState,
  onAnalyze,
  onCancel,
  onRemove,
  onReportToggle,
}: Props) {
  const isRunning =
    runState?.runId != null && !runState.complete && !runState.error;
  const isComplete = runState?.complete != null;
  const [parsedReport, setParsedReport] = useState<ParsedReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const seriesLower = (market.seriesTicker || market.ticker).toLowerCase();
  const titleSlug = slugify(market.eventTitle || market.title);
  const kalshiUrl = `https://kalshi.com/markets/${seriesLower}/${titleSlug}`;

  // Load report metadata + history on mount
  useEffect(() => {
    fetch(`/api/markets/${market.ticker}/report?all=true`)
      .then(async (r) => {
        if (r.ok) {
          const entries: ReportEntry[] = await r.json();
          if (entries.length > 0) {
            setHasReport(true);
            setReportHistory(entries);
            setSelectedFile(entries[0].filename);
          }
        }
      })
      .catch(() => {});
    // Also load the latest report content for inline estimate display
    fetch(`/api/markets/${market.ticker}/report`)
      .then(async (r) => {
        if (r.ok) {
          const raw = await r.text();
          setParsedReport(parseReport(raw));
        }
      })
      .catch(() => {});
  }, [market.ticker]);

  // Parse and show report when current run completes
  useEffect(() => {
    if (isComplete && runState?.runId) {
      setHasReport(true);
      fetch(`/api/analyze/${runState.runId}/report`)
        .then(async (r) => {
          if (r.ok) {
            const raw = await r.text();
            setParsedReport(parseReport(raw));
          }
        })
        .catch(() => {});
      // Refresh history list
      fetch(`/api/markets/${market.ticker}/report?all=true`)
        .then(async (r) => {
          if (r.ok) {
            const entries: ReportEntry[] = await r.json();
            if (entries.length > 0) {
              setReportHistory(entries);
              setSelectedFile(entries[0].filename);
            }
          }
        })
        .catch(() => {});
    }
  }, [isComplete, runState?.runId, market.ticker]);

  const loadReport = (filename: string) => {
    setLoadingReport(true);
    fetch(`/api/markets/${market.ticker}/report?file=${encodeURIComponent(filename)}`)
      .then(async (r) => {
        if (r.ok) {
          const raw = await r.text();
          setParsedReport(parseReport(raw));
          setSelectedFile(filename);
          setReportOpen(true);
          onReportToggle?.(true);
        }
      })
      .finally(() => setLoadingReport(false));
  };

  const handleViewReport = () => {
    if (reportOpen) {
      setReportOpen(false);
      onReportToggle?.(false);
      return;
    }
    if (parsedReport) {
      setReportOpen(true);
      onReportToggle?.(true);
      return;
    }
    // Fallback: load latest
    setLoadingReport(true);
    fetch(`/api/markets/${market.ticker}/report`)
      .then(async (r) => {
        if (r.ok) {
          const raw = await r.text();
          setParsedReport(parseReport(raw));
          setReportOpen(true);
          onReportToggle?.(true);
        }
      })
      .finally(() => setLoadingReport(false));
  };

  const typeLabel =
    market.marketType === "event"
      ? `EVENT \u00B7 ${market.outcomes?.length || 0} outcomes`
      : "BINARY";

  // Extract estimate for inline display
  const estimate = parsedReport?.estimatedProbability;
  const edge = parsedReport?.edge;
  const edgeDir = parsedReport?.edgeDirection;

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
          <div className="text-right text-sm tabular-nums whitespace-nowrap space-y-0.5">
            <div>
              <span className="text-green-400">
                YES {((market.yesPrice || 0) * 100).toFixed(0)}{"\u00A2"}
              </span>
              <span className="text-neutral-600 mx-1">|</span>
              <span className="text-red-400">
                NO {((market.noPrice || 0) * 100).toFixed(0)}{"\u00A2"}
              </span>
            </div>
            {/* Show estimate vs market when report exists */}
            {estimate && edge && (
              <div className="text-xs">
                <span className="text-neutral-500">Est: </span>
                <span className="text-neutral-300 font-medium">{estimate}</span>
                <span className="mx-1 text-neutral-700">|</span>
                <span className={
                  edgeDir === "yes" ? "text-green-400" :
                  edgeDir === "no" ? "text-red-400" :
                  "text-neutral-500"
                }>
                  {edge.split("->")[0].trim()}
                </span>
              </div>
            )}
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
              +{market.subThresholdCount} more under 5{"\u00A2"}
            </div>
          )}
        </div>
      )}

      {/* Progress stepper + live activity feed */}
      {isRunning && runState && (
        <div className="mb-3">
          <ProgressStepper
            stages={runState.stages}
            progressHistory={runState.progressHistory}
          />
        </div>
      )}

      {/* Error */}
      {runState?.error && (
        <div className="text-xs text-red-400 mb-3">{runState.error}</div>
      )}

      {/* Report history selector */}
      {reportOpen && reportHistory.length > 1 && (
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="text-neutral-500">Report:</span>
          <select
            value={selectedFile || ""}
            onChange={(e) => loadReport(e.target.value)}
            className="bg-neutral-800 text-neutral-300 border border-neutral-700 rounded px-2 py-0.5 text-xs"
          >
            {reportHistory.map((entry) => (
              <option key={entry.filename} value={entry.filename}>
                {entry.date} {entry.time}
                {entry.filename === reportHistory[0].filename ? " (latest)" : ""}
              </option>
            ))}
          </select>
          <span className="text-neutral-600">
            {reportHistory.length} report{reportHistory.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Report viewer */}
      {reportOpen && parsedReport && (
        <div className="mb-3">
          <ReportViewer report={parsedReport} />
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
            {loadingReport
              ? "Loading..."
              : reportOpen
                ? "Hide Report"
                : "View Report"}
          </button>
        )}
        {isRunning ? (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs bg-red-900/50 text-red-300 rounded hover:bg-red-800/50 border border-red-800/50"
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
