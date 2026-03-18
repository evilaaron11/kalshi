import { describe, it, expect } from "vitest";
import {
  evidenceBinary,
  evidenceEvent,
  devilsAdvocateBinary,
  calibratorBinary,
} from "../lib/prompts";

describe("prompt templates", () => {
  it("evidenceBinary includes market details and fetcher docs", () => {
    const prompt = evidenceBinary(
      "Will there be a shutdown?",
      "Resolves YES if...",
      "2026-04-01",
      "65%",
    );
    expect(prompt).toContain("Will there be a shutdown?");
    expect(prompt).toContain("Resolves YES if...");
    expect(prompt).toContain("2026-04-01");
    expect(prompt).toContain("65%");
    expect(prompt).toContain("npx tsx lib/fetchers/cli.ts");
    expect(prompt).not.toContain("python");
  });

  it("evidenceEvent includes outcomes text", () => {
    const prompt = evidenceEvent(
      "Fed Chair",
      "2026-06-01",
      "Resolves to...",
      "1. Powell — 45%\n2. Warsh — 30%",
    );
    expect(prompt).toContain("Powell — 45%");
    expect(prompt).toContain("multi-outcome");
  });

  it("devilsAdvocateBinary includes evidence and sources", () => {
    const prompt = devilsAdvocateBinary(
      "Market Title",
      "Rules",
      "2026-04-01",
      "70%",
      "Evidence output here",
      "## SOURCES POOL\n- [src] | [url]",
    );
    expect(prompt).toContain("Evidence output here");
    expect(prompt).toContain("SOURCES POOL");
    expect(prompt).toContain("contrarian");
  });

  it("calibratorBinary includes all agent outputs", () => {
    const prompt = calibratorBinary(
      "Title",
      "Rules",
      "2026-04-01",
      "55%",
      5000,
      "evidence",
      "da",
      "resolution",
      "chaos",
    );
    expect(prompt).toContain("evidence");
    expect(prompt).toContain("DEVIL'S ADVOCATE");
    expect(prompt).toContain("RESOLUTION");
    expect(prompt).toContain("CHAOS");
    expect(prompt).toContain("5000");
    expect(prompt).toContain("BETTING RECOMMENDATION");
  });
});
