import type { ValidationResult } from "./calibrator";

const MIN_EVIDENCE_SOURCES = 3;
const MIN_DA_SOURCES = 1;

/**
 * Slice out the body of a top-level "## SECTION HEADER" up to the next "## " or EOF.
 * Used to scope source-count checks to a specific section so we don't pick up
 * URLs from elsewhere in the agent's output.
 */
function extractSection(text: string, header: string): string | null {
  const idx = text.indexOf(header);
  if (idx === -1) return null;
  const start = idx + header.length;
  const rest = text.slice(start);
  const nextSection = rest.search(/\n##\s/);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

/** Count list items in a section body that contain an http(s) URL. */
function countUrlBullets(sectionBody: string): number {
  return sectionBody
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .filter((l) => /https?:\/\//.test(l)).length;
}

export function validateEvidenceAgent(rawEvidence: string): ValidationResult {
  const issues: string[] = [];
  const section = extractSection(rawEvidence, "## SOURCES POOL");
  if (section === null) {
    issues.push("Missing '## SOURCES POOL' section");
  } else {
    const count = countUrlBullets(section);
    if (count < MIN_EVIDENCE_SOURCES) {
      issues.push(
        `SOURCES POOL has ${count} URL-bearing entries — need at least ${MIN_EVIDENCE_SOURCES}`,
      );
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateDevilsAdvocate(rawDA: string): ValidationResult {
  const issues: string[] = [];
  const section = extractSection(rawDA, "## ADDITIONAL SOURCES");
  if (section === null) {
    issues.push("Missing '## ADDITIONAL SOURCES' section");
  } else {
    const count = countUrlBullets(section);
    if (count < MIN_DA_SOURCES) {
      issues.push(
        `ADDITIONAL SOURCES has ${count} URL-bearing entries — need at least ${MIN_DA_SOURCES}`,
      );
    }
  }
  return { ok: issues.length === 0, issues };
}
