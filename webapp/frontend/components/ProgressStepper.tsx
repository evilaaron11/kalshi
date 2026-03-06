"use client";

import type { PipelineStage, RunState } from "@/lib/types";

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "fetch", label: "Fetch" },
  { key: "evidence", label: "Evidence" },
  { key: "devil_advocate", label: "DA" },
  { key: "resolution", label: "Res" },
  { key: "chaos", label: "Chaos" },
  { key: "calibrator", label: "Calibrate" },
];

interface Props {
  stages: RunState["stages"];
}

export default function ProgressStepper({ stages }: Props) {
  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      {STAGES.map((s, i) => {
        const info = stages[s.key];
        const isParallel = s.key === "resolution" || s.key === "chaos";

        let color = "bg-neutral-700 text-neutral-400"; // pending
        let icon = "";
        if (info.status === "complete") {
          color = "bg-green-900 text-green-300";
          icon = "\u2713 ";
        } else if (info.status === "running") {
          color = "bg-blue-900 text-blue-300 animate-pulse";
          icon = "\u25CF ";
        } else if (info.status === "error") {
          color = "bg-red-900 text-red-300";
          icon = "\u2717 ";
        }

        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && !isParallel && (
              <span className="text-neutral-600">&mdash;</span>
            )}
            {s.key === "resolution" && (
              <span className="text-neutral-600">&mdash;[</span>
            )}
            <span className={`px-2 py-0.5 rounded ${color}`}>
              {icon}{s.label}
              {info.duration_s != null && (
                <span className="ml-1 opacity-60">{info.duration_s}s</span>
              )}
            </span>
            {isParallel && s.key === "resolution" && (
              <span className="text-neutral-500">||</span>
            )}
            {s.key === "chaos" && (
              <span className="text-neutral-600">]</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
