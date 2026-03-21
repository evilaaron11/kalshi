import { describe, it, expect } from "vitest";
import { getDistrictLean, getCompetitiveRaces } from "../lib/fetchers/pvi";

describe("getDistrictLean", () => {
  it("returns records for a valid state", () => {
    const results = getDistrictLean("GA");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.state === "GA")).toBe(true);
  });

  it("returns both Senate and House records when no district is specified", () => {
    const results = getDistrictLean("GA");
    const chambers = new Set(results.map((r) => r.chamber));
    expect(chambers.has("Senate")).toBe(true);
    expect(chambers.has("House")).toBe(true);
  });

  it("filters to a specific House district when district is provided", () => {
    const results = getDistrictLean("GA", 6);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.chamber === "House" && r.district === 6)).toBe(true);
  });

  it("is case-insensitive for state argument", () => {
    const upper = getDistrictLean("GA");
    const lower = getDistrictLean("ga");
    const mixed = getDistrictLean("Ga");
    expect(lower.length).toBe(upper.length);
    expect(mixed.length).toBe(upper.length);
  });

  it("returns an empty array for an invalid/unknown state", () => {
    const results = getDistrictLean("ZZ");
    expect(results).toEqual([]);
  });

  it("returns only the matching district and no Senate records when district is specified", () => {
    const results = getDistrictLean("NC", 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.chamber === "House")).toBe(true);
    expect(results.every((r) => r.district === 1)).toBe(true);
  });
});

describe("getCompetitiveRaces", () => {
  it("returns competitive races using the default threshold of 5", () => {
    const results = getCompetitiveRaces();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.leanMagnitude <= 5)).toBe(true);
  });

  it("filters correctly with a custom threshold", () => {
    const tight = getCompetitiveRaces(2);
    const broad = getCompetitiveRaces(10);
    expect(tight.every((r) => r.leanMagnitude <= 2)).toBe(true);
    expect(broad.every((r) => r.leanMagnitude <= 10)).toBe(true);
    expect(broad.length).toBeGreaterThanOrEqual(tight.length);
  });

  it("returns results sorted by leanMagnitude ascending", () => {
    const results = getCompetitiveRaces(8);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].leanMagnitude).toBeGreaterThanOrEqual(results[i - 1].leanMagnitude);
    }
  });

  it("returns an empty array when threshold is 0 and no EVEN records are present", () => {
    // Threshold of -1 should always be empty
    const results = getCompetitiveRaces(-1);
    expect(results).toEqual([]);
  });

  it("all returned records have required fields: state, pviScore, leanDirection, chamber", () => {
    const results = getCompetitiveRaces(10);
    for (const record of results) {
      expect(record).toHaveProperty("state");
      expect(record).toHaveProperty("pviScore");
      expect(record).toHaveProperty("leanDirection");
      expect(record).toHaveProperty("chamber");
      expect(typeof record.state).toBe("string");
      expect(record.state.length).toBe(2);
      expect(["R", "D", "EVEN"]).toContain(record.leanDirection);
      expect(["House", "Senate"]).toContain(record.chamber);
    }
  });

  it("includes toss-up (magnitude 0) districts when they exist in the dataset", () => {
    const results = getCompetitiveRaces(5);
    const tossUps = results.filter((r) => r.leanMagnitude === 0);
    expect(tossUps.length).toBeGreaterThan(0);
  });

  it("includes both Senate and House records when both fall within threshold", () => {
    const results = getCompetitiveRaces(5);
    const chambers = new Set(results.map((r) => r.chamber));
    expect(chambers.has("Senate")).toBe(true);
    expect(chambers.has("House")).toBe(true);
  });
});
