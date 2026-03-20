import { describe, it, expect } from "vitest";
import { parseBulletBlock, tokenizeInlineMarkdown } from "../lib/richTextUtils";

describe("parseBulletBlock", () => {
  it("parses dash-prefixed bullets", () => {
    const text = `- First item
- Second item
- Third item`;
    const items = parseBulletBlock(text);
    expect(items).toEqual(["First item", "Second item", "Third item"]);
  });

  it("parses numbered bullets", () => {
    const text = `1. First item
2. Second item
3. Third item`;
    const items = parseBulletBlock(text);
    expect(items).toEqual(["First item", "Second item", "Third item"]);
  });

  it("handles multi-line bullets (continuation lines)", () => {
    const text = `- First item that
  spans two lines
- Second item`;
    const items = parseBulletBlock(text);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("First item that");
    expect(items[0]).toContain("spans two lines");
  });

  it("handles bold-labeled bullets", () => {
    const text = `1. **Epstein Boomerang (4-5%)**: Congressional investigation escalates
2. **DOGE Failure (5-6%)**: Federal workforce cuts manifest`;
    const items = parseBulletBlock(text);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("**Epstein Boomerang");
    expect(items[1]).toContain("**DOGE Failure");
  });

  it("handles asterisk bullets", () => {
    const items = parseBulletBlock("* item one\n* item two");
    expect(items).toEqual(["item one", "item two"]);
  });

  it("handles single paragraph (no bullets)", () => {
    const text = "This is just a paragraph with no bullet points at all.";
    const items = parseBulletBlock(text);
    expect(items).toEqual([text]);
  });

  it("skips blank lines", () => {
    const text = `- First

- Second

- Third`;
    const items = parseBulletBlock(text);
    expect(items).toEqual(["First", "Second", "Third"]);
  });

  it("handles real tail risk format", () => {
    const text = `1. **Stratospheric Aerosol Injection (SAI) deployment** (~2% probability): If wealthy nations deploy SAI by 2038–2042 to cap warming at 1.5–1.8°C, annual anomalies could be artificially suppressed below 2°C indefinitely.
2. **Amazon tipping point + carbon feedback pulse** (~3% probability): Accelerated deforestation triggers Amazon savannification by 2035–2038, releasing a 50–100 GtCO₂ pulse.`;
    const items = parseBulletBlock(text);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Stratospheric Aerosol");
    expect(items[1]).toContain("Amazon tipping point");
  });

  it("handles real resolution watch format", () => {
    const text = `- **Critical ambiguity — "Source Agencies" undefined**: The contract never enumerates which agencies qualify. NOAA's consistent ~0.12°C underread relative to NASA GISS means a near-threshold year could generate genuine operator discretion.
- **2049 report timing trap**: Year-2049 annual temperature reports won't publish until mid-January 2050. The market closes Jan 1, 2050 at 15:00 UTC.
- **Rounding and inter-dataset divergence**: In a marginal crossing year, Berkeley Earth land+ocean vs. land-only diverges by ~0.6°C.`;
    const items = parseBulletBlock(text);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("Critical ambiguity");
    expect(items[1]).toContain("2049 report timing");
    expect(items[2]).toContain("Rounding");
  });

  it("handles betting recommendation format", () => {
    const text = `**NO — $6 at 21 cents per contract (~29 contracts)**
- True p(NO) ≈ 31% vs. market-implied p(NO) = 21%
- Net odds on NO: ~3.76:1 ($0.79 profit per $0.21 risked)
- Kelly fraction: 12.7% → Half-Kelly: ~6.3% of $100 = **$6.30 on NO**
- Thesis: Inter-dataset divergence structurally raises the functional threshold
- Do not size larger: 24-year horizon means enormous uncertainty bands`;
    const items = parseBulletBlock(text);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toContain("NO");
  });
});

describe("tokenizeInlineMarkdown", () => {
  it("tokenizes bold text", () => {
    const segs = tokenizeInlineMarkdown("Hello **world** here");
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ type: "text", value: "Hello " });
    expect(segs[1]).toEqual({ type: "bold", value: "world" });
    expect(segs[2]).toEqual({ type: "text", value: " here" });
  });

  it("tokenizes bare URLs", () => {
    const segs = tokenizeInlineMarkdown("Visit https://example.com for info");
    expect(segs).toHaveLength(3);
    expect(segs[1].type).toBe("link");
    expect(segs[1].url).toBe("https://example.com");
  });

  it("tokenizes markdown links", () => {
    const segs = tokenizeInlineMarkdown("See [Reuters](https://reuters.com/article) for details");
    expect(segs).toHaveLength(3);
    expect(segs[1].type).toBe("link");
    expect(segs[1].label).toBe("Reuters");
    expect(segs[1].url).toBe("https://reuters.com/article");
  });

  it("tokenizes inline code", () => {
    const segs = tokenizeInlineMarkdown("Use `DEMO_KEY` for testing");
    expect(segs).toHaveLength(3);
    expect(segs[1]).toEqual({ type: "code", value: "DEMO_KEY" });
  });

  it("handles plain text with no formatting", () => {
    const segs = tokenizeInlineMarkdown("Just plain text");
    expect(segs).toEqual([{ type: "text", value: "Just plain text" }]);
  });

  it("handles multiple bold sections", () => {
    const segs = tokenizeInlineMarkdown("**First** and **Second**");
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ type: "bold", value: "First" });
    expect(segs[2]).toEqual({ type: "bold", value: "Second" });
  });

  it("handles mixed formatting", () => {
    const segs = tokenizeInlineMarkdown("**Epstein Boomerang (4-5%)**: Congressional investigation at https://cbo.gov escalates");
    const bold = segs.find((s) => s.type === "bold");
    const link = segs.find((s) => s.type === "link");
    expect(bold?.value).toContain("Epstein Boomerang");
    expect(link?.url).toBe("https://cbo.gov");
  });
});
