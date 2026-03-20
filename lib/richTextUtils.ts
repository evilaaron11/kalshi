/**
 * Parse a block of text into structured bullet items.
 * Handles:
 * - Lines starting with - or * or numbered (1. 2. etc.)
 * - Multi-line bullets (continuation lines not starting with bullet)
 */
export function parseBulletBlock(text: string): string[] {
  const lines = text.split("\n");
  const items: string[] = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isBullet = /^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
    if (isBullet) {
      if (current) items.push(current);
      current = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    } else if (current) {
      current += " " + trimmed;
    } else {
      current = trimmed;
    }
  }
  if (current) items.push(current);

  return items;
}

/**
 * Tokenize inline markdown into segments for rendering.
 * Handles: **bold**, [label](url), bare URLs, `code`
 */
export interface TextSegment {
  type: "text" | "bold" | "link" | "code";
  value: string;
  url?: string;
  label?: string;
}

export function tokenizeInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s),]+)|`([^`]+)`/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[1] != null) {
      segments.push({ type: "bold", value: match[1] });
    } else if (match[2] != null && match[3] != null) {
      segments.push({ type: "link", value: match[2], label: match[2], url: match[3] });
    } else if (match[4] != null) {
      segments.push({ type: "link", value: match[4], label: match[4], url: match[4] });
    } else if (match[5] != null) {
      segments.push({ type: "code", value: match[5] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
