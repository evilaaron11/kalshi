/**
 * Parse a raw pipeline report (markdown) into structured sections.
 * Tolerant of missing sections — returns null for anything not found.
 */

export interface SourceEntry {
  title: string;
  url: string;
}

export interface RankingEntry {
  rank: number;
  outcome: string;
  marketPrice: string;
  estimate: string;
  edge: string;
  reasoning: string;
}

export interface ParsedReport {
  // Header
  title: string;
  ticker: string;
  generatedAt: string;

  // Calibrator header fields
  marketName: string;
  closeDate: string;
  volume: string;

  // Binary-specific
  estimatedProbability: string | null;
  marketPrice: string | null;
  edge: string | null;
  edgeDirection: "yes" | "no" | "none";
  confidence: string | null;
  crux: string | null;

  // Event-specific
  rankings: RankingEntry[];
  darkHorse: string | null;

  // Shared sections
  bullCase: string[];
  bearCase: string[];
  tailRisks: string | null;
  resolutionWatch: string | null;
  keySources: SourceEntry[];
  analystNotes: string | null;
  crossMarket: string | null;
  bettingRecommendation: string | null;
  probabilityMethodology: string | null;

  // Sub-agent raw outputs
  evidenceAgent: string | null;
  devilsAdvocate: string | null;
  resolutionAnalysis: string | null;
  chaosAgent: string | null;

  // Delta analysis (if present)
  deltaAnalysis: string | null;

  // Raw calibrator text (fallback)
  rawCalibrator: string;
}

function extractSection(text: string, header: string): string | null {
  const idx = text.indexOf(header);
  if (idx === -1) return null;
  const start = idx + header.length;
  // Find next section header (## or end of text)
  const nextHeader = text.indexOf("\n## ", start);
  return text.slice(start, nextHeader === -1 ? undefined : nextHeader).trim();
}

function extractLabelValue(text: string, label: string): string | null {
  // Match "LABEL:  value" or "LABEL:value" (case insensitive, flexible whitespace)
  const regex = new RegExp(`${label}\\s*[:.]\\s*(.+?)(?:\\n|$)`, "i");
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

function extractBulletList(text: string, sectionLabel: string): string[] {
  const regex = new RegExp(`${sectionLabel}\\s*[:.]?\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+[:.\\n]|$)`);
  const m = text.match(regex);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l.length > 0);
}

function parseSources(text: string): SourceEntry[] {
  const section = text.match(/KEY SOURCES\s*[:.]?\s*\n([\s\S]*?)(?=\n[A-Z][A-Z\s]+[:.]\s*\n|$)/);
  if (!section) return [];
  const lines = section[1].split("\n").filter((l) => l.trim().startsWith("-"));
  return lines.map((l) => {
    const clean = l.replace(/^[-*]\s*/, "").trim();
    // Try to extract URL from markdown link or bare URL
    const urlMatch = clean.match(/\bhttps?:\/\/\S+/);
    const title = clean.replace(/\s*\bhttps?:\/\/\S+/, "").replace(/[[\]()]/g, "").trim();
    return { title: title || clean, url: urlMatch?.[0] || "" };
  });
}

function parseRankings(text: string): RankingEntry[] {
  const section = text.match(/RANKING\s*[:.]?\s*\n([\s\S]*?)(?=\nDARK HORSE|TAIL RISKS|CONFIDENCE|$)/i);
  if (!section) return [];

  const entries: RankingEntry[] = [];
  const blocks = section[1].split(/\n(?=#\d|#N)/);

  for (const block of blocks) {
    const rankMatch = block.match(/#(\d+)/);
    if (!rankMatch) continue;

    const rank = parseInt(rankMatch[1]);
    const outcomeMatch = block.match(/#\d+[^:]*:\s*(.+)/);
    const outcome = outcomeMatch ? outcomeMatch[1].trim() : "";
    const mp = extractLabelValue(block, "Market price") || "";
    const est = extractLabelValue(block, "Your estimate") || "";
    const edge = extractLabelValue(block, "Edge") || "";
    const why = extractLabelValue(block, "Why") || "";

    entries.push({ rank, outcome, marketPrice: mp, estimate: est, edge, reasoning: why });
  }

  return entries;
}

export function parseReport(raw: string): ParsedReport {
  // Split into top-level sections
  const calibratorSection = extractSection(raw, "## Calibrator Report") || raw;
  const evidenceSection = extractSection(raw, "## Evidence Agent");
  const daSection = extractSection(raw, "## Devil's Advocate");
  const resolutionSection = extractSection(raw, "## Resolution Analysis");
  const chaosSection = extractSection(raw, "## Chaos Agent");
  const deltaSection = extractSection(raw, "## Delta Analysis");

  // Parse header
  const titleMatch = raw.match(/^# Analysis:\s*(.+)/m);
  const tickerMatch = raw.match(/^Ticker:\s*(.+)/m);
  const generatedMatch = raw.match(/^Generated:\s*(.+)/m);

  // Parse calibrator fields
  const estProb = extractLabelValue(calibratorSection, "ESTIMATED PROBABILITY");
  const marketPrice = extractLabelValue(calibratorSection, "MARKET PRICE");
  const edge = extractLabelValue(calibratorSection, "EDGE");
  const confidence = extractLabelValue(calibratorSection, "CONFIDENCE");
  const crux = extractLabelValue(calibratorSection, "CRUX");
  const closeDate = extractLabelValue(calibratorSection, "CLOSES") || "";
  const volume = extractLabelValue(calibratorSection, "VOLUME") || "";
  const darkHorse = extractLabelValue(calibratorSection, "DARK HORSE");

  // Determine edge direction
  let edgeDirection: "yes" | "no" | "none" = "none";
  if (edge) {
    if (/lean\s*YES/i.test(edge) || (edge.startsWith("+") && !edge.startsWith("+0") && !edge.startsWith("+~0"))) {
      edgeDirection = "yes";
    } else if (/lean\s*NO/i.test(edge) || edge.startsWith("-")) {
      edgeDirection = "no";
    }
  }

  // Parse sections
  const bullCase = extractBulletList(calibratorSection, "BULL CASE");
  const bearCase = extractBulletList(calibratorSection, "BEAR CASE");
  const tailRisks = extractLabeledBlock(calibratorSection, "TAIL RISKS");
  const resolutionWatch = extractLabeledBlock(calibratorSection, "RESOLUTION WATCH");
  const analystNotes = extractLabeledBlock(calibratorSection, "ANALYST NOTES");
  const crossMarket = extractLabeledBlock(calibratorSection, "CROSS-MARKET COMPARISON");
  const bettingRec = extractLabeledBlock(calibratorSection, "BETTING RECOMMENDATION") ||
    extractLabeledBlockLoose(calibratorSection, "BETTING RECOMMENDATION");
  const methodology = extractLabeledBlock(calibratorSection, "PROBABILITY METHODOLOGY");

  const rankings = parseRankings(calibratorSection);
  const sources = parseSources(calibratorSection);

  return {
    title: titleMatch?.[1] || "",
    ticker: tickerMatch?.[1] || "",
    generatedAt: generatedMatch?.[1] || "",
    marketName: titleMatch?.[1] || "",
    closeDate,
    volume,
    estimatedProbability: estProb,
    marketPrice,
    edge,
    edgeDirection,
    confidence,
    crux,
    rankings,
    darkHorse,
    bullCase,
    bearCase,
    tailRisks,
    resolutionWatch,
    keySources: sources,
    analystNotes,
    crossMarket,
    bettingRecommendation: bettingRec,
    probabilityMethodology: methodology,
    evidenceAgent: evidenceSection,
    devilsAdvocate: daSection,
    resolutionAnalysis: resolutionSection,
    chaosAgent: chaosSection,
    deltaAnalysis: deltaSection,
    rawCalibrator: calibratorSection,
  };
}

function extractLabeledBlock(text: string, label: string): string | null {
  const regex = new RegExp(`${label}\\s*[:.]?\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]{3,}[:.\\n]|$)`);
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

/** Looser version that handles labels with parenthetical suffixes like "BETTING RECOMMENDATION ($100 BANKROLL):" */
function extractLabeledBlockLoose(text: string, label: string): string | null {
  const regex = new RegExp(`${label}[^\\n]*[:.]?\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]{3,}[(:.]|$)`);
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}
