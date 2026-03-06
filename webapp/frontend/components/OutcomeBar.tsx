"use client";

import type { OutcomeSummary } from "@/lib/types";

interface Props {
  outcome: OutcomeSummary;
  label: string;
  maxPrice: number;
}

export default function OutcomeBar({ outcome, label, maxPrice }: Props) {
  const price = outcome.yes_price ?? 0;
  const pct = maxPrice > 0 ? (price / maxPrice) * 100 : 0;
  const cents = Math.round(price * 100);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-44 shrink-0 truncate text-neutral-300" title={outcome.title}>
        {label}
      </span>
      <div className="flex-1 h-4 bg-neutral-800 rounded overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-neutral-400">
        {cents}&cent;
      </span>
    </div>
  );
}
