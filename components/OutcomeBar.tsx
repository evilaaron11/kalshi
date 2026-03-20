"use client";

interface Props {
  title: string;
  yesPrice?: number;
}

export default function OutcomeBar({ title, yesPrice }: Props) {
  const pct = (yesPrice || 0) * 100;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 truncate text-neutral-300" title={title}>
        {title}
      </span>
      <div className="flex-1 h-4 bg-neutral-800 rounded overflow-hidden">
        <div
          className="h-full bg-blue-500/60 rounded"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-neutral-400 tabular-nums">
        {pct.toFixed(0)}{"¢"}
      </span>
    </div>
  );
}
