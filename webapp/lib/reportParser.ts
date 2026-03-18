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

/**
 * The known top-level section headers written by saveReport() in pipeline.ts.
 * Sub-headers inside agent output (## FACTUAL SUMMARY, ## SOURCES POOL, etc.)
 * are NOT top-level — they belong to the parent section.
 */
const TOP_LEVEL_HEADERS = [
  "## Calibrator Report",
  "## Evidence Agent",
  "## Devil's Advocate",
  "## Resolution Analysis",
  "## Chaos Agent",
  "## Delta Analysis",
];

/**
 * Extract a top-level section, stopping only at the next known top-level header.
 * This prevents sub-headers inside agent output from truncating the section.
 */
function extractTopLevelSection(text: string, header: string): string | null {
  const idx = text.indexOf(header);
  if (idx === -1) return null;
  const start = idx + header.length;

  // Find the earliest next top-level header after our start position
  let end = text.length;
  for (const h of TOP_LEVEL_HEADERS) {
    if (h === header) continue;
    const pos = text.indexOf(`\n${h}`, start);
    if (pos !== -1 && pos < end) {
      end = pos;
    }
  }

  return text.slice(start, end).trim();
}

function extractLabelValue(text: string, label: string): string | null {
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

/**
 * Parse sources from the calibrator's KEY SOURCES section.
 * These typically have NO URLs — just "title — source (date)" format.
 */
function parseKeySources(text: string): SourceEntry[] {
  const section = text.match(/KEY SOURCES\s*[:.]?\s*\n([\s\S]*?)(?=\n---|\n[A-Z][A-Z\s]+[:.]\s*\n|$)/);
  if (!section) return [];
  const lines = section[1].split("\n").filter((l) => l.trim().startsWith("-"));
  return lines.map((l) => {
    const clean = l.replace(/^[-*]\s*/, "").trim();
    // Check for markdown link: [title](url)
    const mdLink = clean.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (mdLink) {
      return { title: mdLink[1], url: mdLink[2] };
    }
    // Check for bare URL
    const urlMatch = clean.match(/\bhttps?:\/\/\S+/);
    if (urlMatch) {
      const title = clean.replace(/\s*\bhttps?:\/\/\S+/, "").replace(/[[\]()]/g, "").trim();
      return { title: title || clean, url: urlMatch[0] };
    }
    // Strip quotes around title
    const stripped = clean.replace(/^["']|["']$/g, "");
    return { title: stripped, url: "" };
  });
}

/**
 * Parse sources from the evidence agent's SOURCES POOL section.
 * These have full markdown links: [title](url)
 */
function parseSourcesPool(text: string): SourceEntry[] {
  if (!text) return [];
  const section = text.match(/## SOURCES POOL\s*\n([\s\S]*?)(?=\n## |$)/);
  if (!section) return [];
  const lines = section[1].split("\n").filter((l) => l.trim().startsWith("-"));
  return lines.map((l) => {
    const clean = l.replace(/^[-*]\s*/, "").trim();
    // markdown link: [title](url)
    const mdLink = clean.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (mdLink) {
      return { title: mdLink[1], url: mdLink[2] };
    }
    // Pipe-separated: [title] | [url]
    const pipeMatch = clean.match(/\[([^\]]+)\]\s*\|\s*\[?(https?:\/\/[^\s\]]+)/);
    if (pipeMatch) {
      return { title: pipeMatch[1], url: pipeMatch[2] };
    }
    // bare URL
    const urlMatch = clean.match(/\bhttps?:\/\/\S+/);
    if (urlMatch) {
      const title = clean.replace(/\s*\bhttps?:\/\/\S+/, "").replace(/[[\]()]/g, "").trim();
      return { title: title || urlMatch[0], url: urlMatch[0] };
    }
    return { title: clean.replace(/[[\]]/g, ""), url: "" };
  });
}

function parseRankings(text: string): RankingEntry[] {
  // Each alternative must be preceded by \n to avoid matching inside ranking text
  const section = text.match(/RANKING\s*[:.]?\s*\n([\s\S]*?)(?=\n---\s*\n|\nDARK HORSE|\nTAIL RISKS|\nCONFIDENCE|\n## |$)/i);
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
  // Split into top-level sections using the known headers
  const calibratorSection = extractTopLevelSection(raw, "## Calibrator Report") || raw;
  const evidenceSection = extractTopLevelSection(raw, "## Evidence Agent");
  const daSection = extractTopLevelSection(raw, "## Devil's Advocate");
  const resolutionSection = extractTopLevelSection(raw, "## Resolution Analysis");
  const chaosSection = extractTopLevelSection(raw, "## Chaos Agent");
  const deltaSection = extractTopLevelSection(raw, "## Delta Analysis");

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

  // Merge sources: KEY SOURCES (from calibrator) + SOURCES POOL (from evidence agent)
  const keySources = parseKeySources(calibratorSection);
  const poolSources = parseSourcesPool(evidenceSection || "");
  // Deduplicate: if a key source has no URL, try to find a matching pool source by title similarity
  const mergedSources = mergeSourceLists(keySources, poolSources);

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
    keySources: mergedSources,
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

/**
 * Merge KEY SOURCES (may lack URLs) with SOURCES POOL (has URLs).
 * For key sources without URLs, attempt to match by title keyword overlap.
 * Append any pool sources not already represented.
 */
function mergeSourceLists(keySources: SourceEntry[], poolSources: SourceEntry[]): SourceEntry[] {
  if (poolSources.length === 0) return keySources;
  if (keySources.length === 0) return poolSources;

  const usedPoolIndices = new Set<number>();

  const merged = keySources.map((ks) => {
    if (ks.url) return ks; // Already has a URL

    // Try to find matching pool source by title keyword overlap
    const ksWords = ks.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < poolSources.length; i++) {
      if (usedPoolIndices.has(i)) continue;
      const ps = poolSources[i];
      if (!ps.url) continue;
      const psText = ps.title.toLowerCase();
      const hits = ksWords.filter((w) => psText.includes(w)).length;
      if (hits > bestScore && hits >= 2) {
        bestScore = hits;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0) {
      usedPoolIndices.add(bestMatch);
      return { title: ks.title, url: poolSources[bestMatch].url };
    }
    return ks;
  });

  // Append unmatched pool sources that have URLs
  for (let i = 0; i < poolSources.length; i++) {
    if (!usedPoolIndices.has(i) && poolSources[i].url) {
      merged.push(poolSources[i]);
    }
  }

  return merged;
}

function extractLabeledBlock(text: string, label: string): string | null {
  const regex = new RegExp(`${label}\\s*[:.]?\\s*\\n([\\s\\S]*?)(?=\\n---\\s*\\n|\\n[A-Z][A-Z\\s]{3,}[:.\\n]|$)`);
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

/** Looser version that handles labels with parenthetical suffixes like "BETTING RECOMMENDATION ($100 BANKROLL):" */
function extractLabeledBlockLoose(text: string, label: string): string | null {
  const regex = new RegExp(`${label}[^\\n]*[:.]?\\s*\\n([\\s\\S]*?)(?=\\n---\\s*\\n|\\n[A-Z][A-Z\\s]{3,}[(:.]|$)`);
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}
