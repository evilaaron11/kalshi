"use client";

import { useState } from "react";
import type { StageEvent, PipelineStage, ProgressDetail } from "@/lib/types";
import StageDetail from "./StageDetail";

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "fetch", label: "Fetch" },
  { key: "evidence", label: "Evidence" },
  { key: "devil_advocate", label: "Devil's Advocate" },
  { key: "resolution", label: "Resolution" },
  { key: "chaos", label: "Chaos" },
  { key: "calibrator", label: "Calibrate" },
];

interface Props {
  stages: Record<string, StageEvent>;
  progressHistory: Record<string, ProgressDetail[]>;
}

export default function ProgressStepper({ stages, progressHistory }: Props) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  return (
    <div className="space-y-0.5">
      {/* Compact stage indicators */}
      <div className="flex items-center gap-1 text-xs flex-wrap">
        {STAGES.map(({ key, label }, i) => {
          const s = stages[key];
          const status = s?.status || "pending";
          const items = progressHistory[key] || [];
          const count = items.length;

          // Resolution and Chaos run in parallel
          const isParallelPair = key === "resolution";
          const nextIsParallel = STAGES[i + 1]?.key === "chaos";

          let dot: string;
          let color: string;
          if (status === "complete") {
            dot = "\u2713";
            color = "text-green-400";
          } else if (status === "running") {
            dot = "\u25CF";
            color = "text-blue-400 animate-pulse";
          } else if (status === "error") {
            dot = "\u2717";
            color = "text-red-400";
          } else {
            dot = "\u25CB";
            color = "text-neutral-600";
          }

          const isClickable = status === "complete" || status === "error" || count > 0;

          return (
            <span key={key} className="flex items-center gap-1">
              <button
                onClick={() => isClickable && setExpandedStage(expandedStage === key ? null : key)}
                className={`flex items-center gap-1 ${color} ${
                  isClickable ? "hover:underline cursor-pointer" : "cursor-default"
                }`}
                disabled={!isClickable}
              >
                {dot} {label}
                {count > 0 && status === "complete" && (
                  <span className="text-neutral-600 no-underline">({count})</span>
                )}
              </button>
              {s?.durationS != null && status === "complete" && (
                <span className="text-neutral-600">{s.durationS.toFixed(0)}s</span>
              )}
              {i < STAGES.length - 1 && (
                <span className="text-neutral-700">
                  {isParallelPair && nextIsParallel ? "\u2016" : "\u2500"}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Auto-expand running stages, manual expand completed ones */}
      {STAGES.map(({ key, label }) => {
        const s = stages[key];
        const status = s?.status || "pending";
        const items = progressHistory[key] || [];
        const isRunning = status === "running";
        const show = isRunning || expandedStage === key;

        if (!show) return null;

        if (items.length === 0) {
          // Completed or running stage with no events yet — show status message
          const message = status === "error"
            ? s?.detail || "Stage failed"
            : status === "running"
              ? key === "calibrator"
                ? "Synthesizing all agent outputs..."
                : `Running ${label.toLowerCase()} analysis...`
              : key === "fetch"
                ? "Market data fetched from Kalshi API"
                : `${label} analysis complete`;
          return (
            <div key={key} className="mt-1.5 ml-4 border-l border-neutral-800 pl-3">
              <div className={`text-xs ${
                status === "error" ? "text-red-400" :
                status === "running" ? "text-neutral-400 animate-pulse" :
                "text-neutral-500"
              }`}>
                {message}
              </div>
            </div>
          );
        }

        return (
          <StageDetail key={key} items={items} isRunning={isRunning} />
        );
      })}
    </div>
  );
}
