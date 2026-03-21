import fs from "fs";
import path from "path";
import type { PviRecord } from "../types";

// Module-level cache — loaded once on first use
let _cache: PviRecord[] | null = null;

function loadData(): PviRecord[] {
  if (_cache !== null) return _cache;

  const dataPath = path.resolve(__dirname, "../../data/cook-pvi.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  _cache = JSON.parse(raw) as PviRecord[];
  return _cache;
}

/**
 * Return PVI records for a given state, optionally filtered to a specific
 * House district number.
 *
 * - state: two-letter abbreviation, case-insensitive
 * - district: when provided, returns only House records for that district
 *   number; when omitted, returns both Senate and all House districts for
 *   the state
 */
export function getDistrictLean(state: string, district?: number): PviRecord[] {
  const data = loadData();
  const upperState = state.toUpperCase();

  const byState = data.filter((r) => r.state.toUpperCase() === upperState);

  if (district !== undefined) {
    return byState.filter((r) => r.chamber === "House" && r.district === district);
  }

  return byState;
}

/**
 * Return all records where leanMagnitude <= threshold (default 5), sorted
 * ascending by leanMagnitude so the most competitive races appear first.
 */
export function getCompetitiveRaces(threshold = 5): PviRecord[] {
  const data = loadData();

  return data
    .filter((r) => r.leanMagnitude <= threshold)
    .sort((a, b) => a.leanMagnitude - b.leanMagnitude);
}
