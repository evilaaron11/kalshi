import { parseReport } from "../reportParser";

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

/**
 * Configures the mutually-exclusive sum check for event markets.
 * When provided, the Calibrator's RANKING estimates must sum within
 * [expectedRankingSum - tolerance, expectedRankingSum + tolerance] (as decimals, 0-1).
 *
 * Pipeline derives expectedRankingSum as `1 - subThresholdYesPriceSum`, so reasonable
 * sub-threshold tails don't force the qualifying outcomes to over-sum.
 */
export interface SumCheckConfig {
  expectedRankingSum: number;
  tolerance: number;
}

const MIN_PROB = 1;
const MAX_PROB = 99;
const MIN_BULLETS = 2;
const MIN_KEY_SOURCES = 2;
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

const CROSS_MARKET_GAP_PP = 15;
const CROSS_MARKET_MIN_JUSTIFICATION_WORDS = 25;
const CROSS_MARKET_PLATFORMS = ["Polymarket", "Metaculus", "Manifold"];

function parseProbability(value: string | null): number | null {
  if (!value) return null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isNaN(n) ? null : n;
}

/**
 * For each cross-market platform mentioned in `text`, extract the FIRST percentage
 * that appears after the platform name within the same line/sentence. Returns a map
 * of platform → percentage. Skips when the section says "No cross-market matches found".
 */
function extractPlatformPrices(text: string): Map<string, number> {
  const out = new Map<string, number>();
  if (/no cross-market matches found/i.test(text)) return out;
  for (const platform of CROSS_MARKET_PLATFORMS) {
    // "Polymarket: 70%", "Polymarket prices this at 70%", "Polymarket — 70%", etc.
    // Bounded by sentence delimiters so we don't reach across to a different platform's number.
    const re = new RegExp(`${platform}\\b[^.!?\\n]{0,80}?(\\d+(?:\\.\\d+)?)\\s*%`, "i");
    const m = text.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n)) out.set(platform, n);
    }
  }
  return out;
}

/**
 * Heuristic: does the cross-market section contain meaningful prose beyond just
 * "Platform: X%, Platform: Y%"? We count words after stripping the bare-numeric
 * data fragments. Threshold tuned to accept one or two sentences of explanation
 * and reject single-line "Polymarket: 70%, Metaculus: 65%" non-explanations.
 */
function hasJustificationProse(text: string): boolean {
  const stripped = text
    // Remove "Platform: N%" fragments
    .replace(
      new RegExp(
        `\\b(?:${CROSS_MARKET_PLATFORMS.join("|")}|Kalshi)\\b[^.!?\\n]{0,30}?\\d+(?:\\.\\d+)?\\s*%`,
        "gi",
      ),
      "",
    )
    .replace(/[-*|]/g, " ");
  const wordCount = stripped.split(/\s+/).filter((w) => w.length > 1).length;
  return wordCount >= CROSS_MARKET_MIN_JUSTIFICATION_WORDS;
}

/**
 * Cross-market sanity (guardrail #5):
 * If the Calibrator's estimate disagrees with any platform by > 15pp, the
 * CROSS-MARKET COMPARISON section must contain explanatory prose justifying the
 * disagreement. Otherwise the disagreement is suspicious — model may have ignored
 * the cross-market signal.
 */
function checkCrossMarketGap(
  crossMarketSection: string | null,
  calibratorProb: number | null,
  issues: string[],
): void {
  if (!crossMarketSection || calibratorProb === null) return;

  const platformPrices = extractPlatformPrices(crossMarketSection);
  if (platformPrices.size === 0) return;

  let maxGap = 0;
  let gapPlatform = "";
  let gapPrice = 0;
  for (const [platform, price] of platformPrices) {
    const gap = Math.abs(calibratorProb - price);
    if (gap > maxGap) {
      maxGap = gap;
      gapPlatform = platform;
      gapPrice = price;
    }
  }

  if (maxGap > CROSS_MARKET_GAP_PP && !hasJustificationProse(crossMarketSection)) {
    issues.push(
      `Cross-market gap > ${CROSS_MARKET_GAP_PP}pp (Calibrator ${calibratorProb}% vs ${gapPlatform} ${gapPrice}%, gap ${Math.round(maxGap)}pp) — CROSS-MARKET COMPARISON section must explain the disagreement (needs at least ${CROSS_MARKET_MIN_JUSTIFICATION_WORDS} words of prose)`,
    );
  }
}

function validateConfidence(value: string | null, issues: string[]): void {
  if (!value) {
    issues.push("CONFIDENCE missing");
    return;
  }
  const c = value.toLowerCase().trim();
  if (!VALID_CONFIDENCE.has(c)) {
    issues.push(`CONFIDENCE was "${value}" — must be one of low/medium/high`);
  }
}

export function validateCalibratorBinary(rawCalibrator: string): ValidationResult {
  // parseReport expects a full report; wrap the raw body so its section logic works.
  const wrapped = `## Calibrator Report\n${rawCalibrator}`;
  const parsed = parseReport(wrapped);
  const issues: string[] = [];

  const probNum = parseProbability(parsed.estimatedProbability);
  if (probNum === null) {
    issues.push("ESTIMATED PROBABILITY missing or could not be parsed as a percentage");
  } else if (probNum < MIN_PROB || probNum > MAX_PROB) {
    issues.push(`ESTIMATED PROBABILITY was ${probNum}% — must be in [${MIN_PROB}, ${MAX_PROB}]`);
  }

  if (!parsed.marketPrice) issues.push("MARKET PRICE missing");
  if (!parsed.edge) issues.push("EDGE missing");
  if (!parsed.crux) issues.push("CRUX missing");

  validateConfidence(parsed.confidence, issues);

  if (parsed.bullCase.length < MIN_BULLETS) {
    issues.push(`BULL CASE has ${parsed.bullCase.length} bullet(s) — need at least ${MIN_BULLETS}`);
  }
  if (parsed.bearCase.length < MIN_BULLETS) {
    issues.push(`BEAR CASE has ${parsed.bearCase.length} bullet(s) — need at least ${MIN_BULLETS}`);
  }
  if (parsed.keySources.length < MIN_KEY_SOURCES) {
    issues.push(`KEY SOURCES has ${parsed.keySources.length} entries — need at least ${MIN_KEY_SOURCES}`);
  }

  if (!parsed.bettingRecommendation) issues.push("BETTING RECOMMENDATION missing");
  if (!parsed.probabilityMethodology) issues.push("PROBABILITY METHODOLOGY missing");

  checkCrossMarketGap(parsed.crossMarket, probNum, issues);

  return { ok: issues.length === 0, issues };
}

export function validateCalibratorEvent(
  rawCalibrator: string,
  expectedRankingCount: number,
  sumCheck?: SumCheckConfig,
): ValidationResult {
  const wrapped = `## Calibrator Report\n${rawCalibrator}`;
  const parsed = parseReport(wrapped);
  const issues: string[] = [];

  if (parsed.rankings.length < expectedRankingCount) {
    issues.push(
      `RANKING has ${parsed.rankings.length} entries — expected at least ${expectedRankingCount} (one per qualifying market)`,
    );
  }

  // Track parseable probabilities so we can sum them for the mutually-exclusive check.
  let estimateSum = 0;
  let estimatesParsed = 0;
  for (const r of parsed.rankings) {
    const probNum = parseProbability(r.estimate);
    if (probNum === null) {
      issues.push(`Ranking #${r.rank} (${r.outcome || "unnamed"}): "Your estimate" missing or unparseable`);
    } else {
      if (probNum < MIN_PROB || probNum > MAX_PROB) {
        issues.push(
          `Ranking #${r.rank} (${r.outcome || "unnamed"}): estimate ${probNum}% — must be in [${MIN_PROB}, ${MAX_PROB}]`,
        );
      }
      estimateSum += probNum / 100;
      estimatesParsed++;
    }
  }

  // Mutually-exclusive sum check: only when caller signaled it applies and we parsed at least one estimate.
  if (sumCheck && estimatesParsed > 0) {
    const min = sumCheck.expectedRankingSum - sumCheck.tolerance;
    const max = sumCheck.expectedRankingSum + sumCheck.tolerance;
    if (estimateSum < min || estimateSum > max) {
      const sumPct = (estimateSum * 100).toFixed(0);
      const expPct = (sumCheck.expectedRankingSum * 100).toFixed(0);
      const tolPct = (sumCheck.tolerance * 100).toFixed(0);
      issues.push(
        `Ranking estimates sum to ${sumPct}% — expected ${expPct}% ± ${tolPct}pp (event outcomes are mutually exclusive based on Kalshi pricing)`,
      );
    }
  }

  validateConfidence(parsed.confidence, issues);

  if (!parsed.crux) issues.push("CRUX missing");

  if (parsed.keySources.length < MIN_KEY_SOURCES) {
    issues.push(`KEY SOURCES has ${parsed.keySources.length} entries — need at least ${MIN_KEY_SOURCES}`);
  }

  if (!parsed.bettingRecommendation) issues.push("BETTING RECOMMENDATION missing");
  if (!parsed.probabilityMethodology) issues.push("PROBABILITY METHODOLOGY missing");

  return { ok: issues.length === 0, issues };
}

/**
 * Build a retry prompt that re-issues the original task with the validation issues
 * appended so the model knows what to fix. The previous output is included so the model
 * can correct it rather than starting from scratch.
 */
export function buildRetryPrompt(
  originalPrompt: string,
  previousOutput: string,
  issues: string[],
): string {
  const issueList = issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n");
  return `${originalPrompt}

---

YOUR PREVIOUS OUTPUT FAILED VALIDATION. Issues found:
${issueList}

Your previous output was:
---
${previousOutput}
---

Re-produce the report fixing every issue above. Use the EXACT format from the original task. Do not omit any required section.`;
}
