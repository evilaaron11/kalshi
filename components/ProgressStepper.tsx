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

          const isClickable = count > 0;

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
      {STAGES.map(({ key }) => {
        const s = stages[key];
        const status = s?.status || "pending";
        const items = progressHistory[key] || [];
        const isRunning = status === "running";
        const show = isRunning || expandedStage === key;

        if (!show || items.length === 0) return null;

        return (
          <StageDetail key={key} items={items} isRunning={isRunning} />
        );
      })}
    </div>
  );
}
