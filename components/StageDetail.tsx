"use client";

import type { ProgressDetail, ToolCategory } from "@/lib/types";

const CATEGORY_ICONS: Record<ToolCategory, string> = {
  search: "\uD83D\uDD0D",   // magnifying glass
  fetcher: "\uD83D\uDCE1",  // satellite antenna
  bash: "\u2588\u2584",      // terminal block
  thinking: "\uD83E\uDDE0", // brain
};

const CATEGORY_COLORS: Record<ToolCategory, string> = {
  search: "text-blue-400",
  fetcher: "text-amber-400",
  bash: "text-neutral-400",
  thinking: "text-purple-400",
};

interface Props {
  items: ProgressDetail[];
  isRunning: boolean;
}

export default function StageDetail({ items, isRunning }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="mt-1.5 ml-4 space-y-0.5 border-l border-neutral-800 pl-3">
      {items.map((item, i) => {
        const isLatest = i === items.length - 1 && isRunning;
        return (
          <div
            key={`${item.timestamp}-${i}`}
            className={`flex items-start gap-1.5 text-xs leading-snug ${
              isLatest ? "text-neutral-200" : "text-neutral-500"
            }`}
          >
            <span className={`flex-shrink-0 ${CATEGORY_COLORS[item.toolCategory]}`}>
              {CATEGORY_ICONS[item.toolCategory]}
            </span>
            <span className={isLatest ? "animate-pulse" : ""}>
              {item.summary}
            </span>
          </div>
        );
      })}
    </div>
  );
}
