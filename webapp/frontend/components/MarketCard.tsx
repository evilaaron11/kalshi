"use client";

import type { MarketSummary, RunState } from "@/lib/types";
import OutcomeBar from "./OutcomeBar";
import ProgressStepper from "./ProgressStepper";

/** Strip the longest common prefix from outcome titles so labels show the distinguishing part. */
function shortenOutcomeTitle(title: string, outcomes: { title: string }[]): string {
  if (outcomes.length < 2) return title;
  const titles = outcomes.map((o) => o.title);
  let prefixLen = 0;
  for (let i = 0; i < titles[0].length; i++) {
    if (titles.every((t) => t[i] === titles[0][i])) {
      prefixLen = i + 1;
    } else {
      break;
    }
  }
  // Trim to the last space boundary so we don't cut mid-word
  const prefix = titles[0].slice(0, prefixLen);
  const lastSpace = prefix.lastIndexOf(" ");
  const trimAt = lastSpace > 0 ? lastSpace + 1 : prefixLen;
  const short = title.slice(trimAt).trim();
  // If stripping made it empty or too short, fall back to full title
  return short.length > 2 ? short : title;
}

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
  const isRunning = runState && !runState.report_path && !runState.error;
  const isComplete = runState?.report_path != null;
  const hasError = runState?.error != null;

  const typeLabel = market.market_type === "event"
    ? `EVENT \u00B7 ${market.outcomes?.length ?? 0} outcomes`
    : "BINARY";

  const closeDate = market.close_date
    ? new Date(market.close_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-900">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide">
            <span>{typeLabel}</span>
            {isRunning && (
              <span className="text-blue-400 animate-pulse">ANALYZING</span>
            )}
            {isComplete && <span className="text-green-400">COMPLETE</span>}
            {hasError && <span className="text-red-400">ERROR</span>}
          </div>
          <h3 className="text-lg font-semibold text-neutral-100 mt-1">
            {market.title}
          </h3>
        </div>
        <button
          onClick={onRemove}
          className="text-neutral-600 hover:text-red-400 text-sm"
          title="Remove from watchlist"
        >
          &times;
        </button>
      </div>

      {/* Prices */}
      {market.market_type === "binary" && (
        <div className="flex gap-4 text-sm text-neutral-400 mb-2">
          <span>
            YES{" "}
            <span className="text-neutral-200 font-mono">
              {market.yes_price != null ? `${Math.round(market.yes_price * 100)}\u00A2` : "--"}
            </span>
          </span>
          <span>
            NO{" "}
            <span className="text-neutral-200 font-mono">
              {market.no_price != null ? `${Math.round(market.no_price * 100)}\u00A2` : "--"}
            </span>
          </span>
        </div>
      )}

      {/* Event outcomes */}
      {market.market_type === "event" && market.outcomes && (
        <div className="space-y-1 mb-2">
          {market.outcomes.map((o) => {
            const maxPrice = Math.max(
              ...market.outcomes!.map((x) => x.yes_price ?? 0)
            );
            return (
              <OutcomeBar
                key={o.ticker}
                outcome={o}
                label={shortenOutcomeTitle(o.title, market.outcomes!)}
                maxPrice={maxPrice}
              />
            );
          })}
          {market.sub_threshold_count > 0 && (
            <div className="text-xs text-neutral-500">
              +{market.sub_threshold_count} more under 5&cent;
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-neutral-500 mb-3">
        {closeDate && <>Closes: {closeDate} &middot; </>}
        Vol: {market.volume.toLocaleString()}
      </div>

      {/* Pipeline progress */}
      {isRunning && runState && (
        <div className="mb-3 space-y-2">
          <ProgressStepper stages={runState.stages} />
          {runState.detail && (
            <div className="text-xs text-neutral-400">
              Latest: {runState.detail}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="text-sm text-red-400 mb-3">Error: {runState.error}</div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {isRunning ? (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={onAnalyze}
            className="px-3 py-1 text-sm bg-blue-700 text-white rounded hover:bg-blue-600"
          >
            {isComplete ? "Re-run" : "Analyze"} &#9654;
          </button>
        )}
      </div>
    </div>
  );
}
