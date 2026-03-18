"use client";

import type { ReactNode } from "react";
import { tokenizeInlineMarkdown, parseBulletBlock } from "@/lib/richTextUtils";
import type { TextSegment } from "@/lib/richTextUtils";

// Re-export for convenience
export { parseBulletBlock };

interface Props {
  text: string;
  className?: string;
}

function renderSegment(seg: TextSegment, i: number): ReactNode {
  switch (seg.type) {
    case "text":
      return <span key={i}>{seg.value}</span>;
    case "bold":
      return <strong key={i} className="text-neutral-200 font-semibold">{seg.value}</strong>;
    case "link":
      return (
        <a
          key={i}
          href={seg.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 hover:decoration-blue-300/50"
        >
          {(seg.label || seg.value).length > 60 ? (seg.label || seg.value).slice(0, 57) + "..." : (seg.label || seg.value)}
          {" \u2197"}
        </a>
      );
    case "code":
      return (
        <code key={i} className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300 text-xs">
          {seg.value}
        </code>
      );
    default:
      return null;
  }
}

export default function RichText({ text, className = "" }: Props) {
  const segments = tokenizeInlineMarkdown(text);
  return <span className={className}>{segments.map(renderSegment)}</span>;
}
