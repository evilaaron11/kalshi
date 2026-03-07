"use client";

import type { StageEvent, PipelineStage } from "@/lib/types";

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "fetch", label: "Fetch" },
  { key: "evidence", label: "Evidence" },
  { key: "devil_advocate", label: "DA" },
  { key: "resolution", label: "Res" },
  { key: "chaos", label: "Chaos" },
  { key: "calibrator", label: "Calibrate" },
];

interface Props {
  stages: Record<string, StageEvent>;
}

export default function ProgressStepper({ stages }: Props) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {STAGES.map(({ key, label }, i) => {
        const s = stages[key];
        const status = s?.status || "pending";

        // Resolution and Chaos are parallel
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

        return (
          <span key={key} className="flex items-center gap-1">
            <span className={color}>
              {dot} {label}
            </span>
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
  );
}
