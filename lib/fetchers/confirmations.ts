import fs from "fs";
import path from "path";
import type {
  ConfirmationRecord,
  ConfirmationBaseRates,
  RecessAppointment,
} from "../types";

// Module-level caches so JSON is only read once per process
let _confirmations: ConfirmationRecord[] | null = null;
let _appointments: RecessAppointment[] | null = null;

function loadConfirmations(): ConfirmationRecord[] {
  if (_confirmations !== null) return _confirmations;
  const filePath = path.resolve(process.cwd(), "data/confirmations.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  _confirmations = JSON.parse(raw) as ConfirmationRecord[];
  return _confirmations;
}

function loadAppointments(): RecessAppointment[] {
  if (_appointments !== null) return _appointments;
  const filePath = path.resolve(process.cwd(), "data/recess-appointments.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  _appointments = JSON.parse(raw) as RecessAppointment[];
  return _appointments;
}

/**
 * Search historical confirmation records.
 * All filters are optional; results are sorted by yearNominated descending.
 */
export function searchConfirmations(opts: {
  position?: string;
  president?: string;
  outcome?: string;
}): ConfirmationRecord[] {
  const records = loadConfirmations();
  const { position, president, outcome } = opts;

  const positionLower = position?.toLowerCase();
  const presidentLower = president?.toLowerCase();
  const outcomeLower = outcome?.toLowerCase();

  return records
    .filter((r) => {
      if (positionLower && !r.position.toLowerCase().includes(positionLower)) {
        return false;
      }
      if (presidentLower && r.president.toLowerCase() !== presidentLower) {
        return false;
      }
      if (outcomeLower && r.outcome.toLowerCase() !== outcomeLower) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.yearNominated - a.yearNominated);
}

/**
 * Compute base rates for a given position.
 * Matches records by case-insensitive partial match on position.
 * If no records match, falls back to all records for an overall base rate.
 */
export function getBaseRates(position: string): ConfirmationBaseRates {
  const allRecords = loadConfirmations();
  const positionLower = position.toLowerCase();

  let matched = allRecords.filter((r) =>
    r.position.toLowerCase().includes(positionLower),
  );

  // Fall back to all cabinet records if nothing matched
  const broadened = matched.length === 0;
  if (broadened) {
    matched = allRecords;
  }

  const totalCount = matched.length;
  const confirmedCount = matched.filter((r) => r.outcome === "confirmed").length;
  const confirmationRate = totalCount > 0 ? confirmedCount / totalCount : 0;

  const avgDays =
    totalCount > 0
      ? matched.reduce((sum, r) => sum + r.daysToResolution, 0) / totalCount
      : 0;

  const withMargin = matched.filter(
    (r) => r.senateVoteMargin !== undefined && r.senateVoteMargin !== null,
  );
  const avgMargin =
    withMargin.length > 0
      ? withMargin.reduce((sum, r) => sum + (r.senateVoteMargin as number), 0) /
        withMargin.length
      : null;

  return {
    position: broadened ? "All positions (no specific match found)" : position,
    confirmationRate,
    avgDays,
    avgMargin,
    totalCount,
  };
}

/**
 * Return recess appointment records, optionally filtered by president.
 */
export function getAppointments(president?: string): RecessAppointment[] {
  const records = loadAppointments();
  if (!president) return records;
  const presidentLower = president.toLowerCase();
  return records.filter(
    (r) => r.president.toLowerCase() === presidentLower,
  );
}
