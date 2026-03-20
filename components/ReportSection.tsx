"use client";

import { useState } from "react";

interface Props {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}

export default function ReportSection({
  title,
  defaultOpen = true,
  badge,
  badgeColor = "bg-neutral-700",
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-neutral-900 hover:bg-neutral-800/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">{open ? "\u25BC" : "\u25B6"}</span>
          <span className="text-sm font-medium text-neutral-300 uppercase tracking-wide">
            {title}
          </span>
          {badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${badgeColor} text-neutral-200`}>
              {badge}
            </span>
          )}
        </div>
      </button>
      {open && <div className="px-4 py-3 text-sm text-neutral-300">{children}</div>}
    </div>
  );
}
