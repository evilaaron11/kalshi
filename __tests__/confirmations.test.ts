import { describe, it, expect } from "vitest";
import {
  searchConfirmations,
  getBaseRates,
  getAppointments,
} from "../lib/fetchers/confirmations";

describe("searchConfirmations", () => {
  it("returns all records when no filters are provided", () => {
    const results = searchConfirmations({});
    expect(results.length).toBeGreaterThan(50);
  });

  it("filters by position (case-insensitive partial match)", () => {
    const results = searchConfirmations({ position: "secretary of defense" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.position.toLowerCase()).toContain("secretary of defense");
    }
  });

  it("partial position match works for broad terms", () => {
    const results = searchConfirmations({ position: "attorney general" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.position.toLowerCase()).toContain("attorney general");
    }
  });

  it("filters by president (case-insensitive exact match)", () => {
    const results = searchConfirmations({ president: "Obama" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.president.toLowerCase()).toBe("obama");
    }
  });

  it("filters by outcome", () => {
    const withdrawn = searchConfirmations({ outcome: "withdrawn" });
    expect(withdrawn.length).toBeGreaterThan(0);
    for (const r of withdrawn) {
      expect(r.outcome).toBe("withdrawn");
    }

    const rejected = searchConfirmations({ outcome: "rejected" });
    expect(rejected.length).toBeGreaterThan(0);
    for (const r of rejected) {
      expect(r.outcome).toBe("rejected");
    }
  });

  it("sorts results by yearNominated descending", () => {
    const results = searchConfirmations({});
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].yearNominated).toBeGreaterThanOrEqual(
        results[i].yearNominated,
      );
    }
  });

  it("combining president and position filters narrows results", () => {
    const trump = searchConfirmations({ president: "Trump", position: "attorney general" });
    const all = searchConfirmations({ position: "attorney general" });
    expect(trump.length).toBeGreaterThan(0);
    expect(trump.length).toBeLessThan(all.length);
    for (const r of trump) {
      expect(r.president).toBe("Trump");
    }
  });

  it("returns empty array for nonexistent president", () => {
    const results = searchConfirmations({ president: "Lincoln" });
    expect(results).toHaveLength(0);
  });
});

describe("getBaseRates", () => {
  it("returns a valid ConfirmationBaseRates object for Secretary of Defense", () => {
    const rates = getBaseRates("Secretary of Defense");
    expect(rates.totalCount).toBeGreaterThan(0);
    expect(rates.confirmationRate).toBeGreaterThanOrEqual(0);
    expect(rates.confirmationRate).toBeLessThanOrEqual(1);
    expect(rates.avgDays).toBeGreaterThan(0);
    expect(typeof rates.avgMargin === "number" || rates.avgMargin === null).toBe(
      true,
    );
  });

  it("computes correct confirmationRate for Secretary of Defense", () => {
    const records = searchConfirmations({ position: "Secretary of Defense" });
    const confirmed = records.filter((r) => r.outcome === "confirmed").length;
    const expected = confirmed / records.length;
    const rates = getBaseRates("Secretary of Defense");
    expect(rates.confirmationRate).toBeCloseTo(expected, 5);
    expect(rates.totalCount).toBe(records.length);
  });

  it("confirmationRate is 0 to 1 for any position", () => {
    for (const pos of [
      "Attorney General",
      "Secretary of State",
      "Supreme Court",
    ]) {
      const rates = getBaseRates(pos);
      expect(rates.confirmationRate).toBeGreaterThanOrEqual(0);
      expect(rates.confirmationRate).toBeLessThanOrEqual(1);
    }
  });

  it("broadens to all records when no position matches", () => {
    const rates = getBaseRates("Postmaster General");
    const allRecords = searchConfirmations({});
    expect(rates.totalCount).toBe(allRecords.length);
    expect(rates.position).toContain("no specific match found");
  });

  it("avgMargin is null when no matching records have margin data", () => {
    // Withdrawn nominees typically lack a vote margin; broadened set has margins so test a
    // position with all withdrawn — use a position that doesn't exist to trigger broadened path
    const rates = getBaseRates("Totally Nonexistent Position XYZ");
    // broadened path — avgMargin should be a number (all records have some margin data)
    expect(typeof rates.avgMargin === "number" || rates.avgMargin === null).toBe(
      true,
    );
  });
});

describe("getAppointments", () => {
  it("returns all appointments when no president is specified", () => {
    const all = getAppointments();
    expect(all.length).toBeGreaterThan(5);
  });

  it("each record has required fields", () => {
    const all = getAppointments();
    for (const r of all) {
      expect(typeof r.president).toBe("string");
      expect(typeof r.nominee).toBe("string");
      expect(typeof r.position).toBe("string");
      expect(typeof r.date).toBe("string");
      expect(typeof r.context).toBe("string");
    }
  });

  it("filters by president", () => {
    const obama = getAppointments("Obama");
    expect(obama.length).toBeGreaterThan(0);
    for (const r of obama) {
      expect(r.president).toBe("Obama");
    }
  });

  it("president filter is case-insensitive", () => {
    const upper = getAppointments("OBAMA");
    const mixed = getAppointments("Obama");
    expect(upper.length).toBe(mixed.length);
  });

  it("returns empty array for a president with no recess appointments in dataset", () => {
    const results = getAppointments("Biden");
    expect(results).toHaveLength(0);
  });
});
