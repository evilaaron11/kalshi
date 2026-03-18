import { describe, it, expect } from "vitest";
import { stripHtml, matchesQuery } from "../lib/textUtils";

describe("stripHtml", () => {
  it("removes HTML tags and returns plain text", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("<p>Hello</p>  <p>World</p>")).toBe("Hello World");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("no html here")).toBe("no html here");
  });
});

describe("matchesQuery", () => {
  it("matches exact substring", () => {
    expect(matchesQuery("government shutdown deadline", "shutdown")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery("Government Shutdown", "government shutdown")).toBe(true);
  });

  it("matches by keyword overlap (>=2 words >3 chars)", () => {
    expect(
      matchesQuery("federal reserve interest rate decision", "interest rate"),
    ).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchesQuery("anything", "")).toBe(true);
  });

  it("rejects non-matching text", () => {
    expect(matchesQuery("baseball game results", "government shutdown")).toBe(
      false,
    );
  });

  it("matches single keyword >3 chars", () => {
    expect(matchesQuery("tariff policy update", "tariff")).toBe(true);
  });
});
