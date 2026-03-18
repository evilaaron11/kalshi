import { describe, it, expect } from "vitest";
import * as config from "../lib/config";

describe("config", () => {
  it("exports Kalshi host", () => {
    expect(config.KALSHI_HOST).toBe("https://api.elections.kalshi.com");
  });

  it("exports Kalshi API path", () => {
    expect(config.KALSHI_API_PATH).toBe("/trade-api/v2");
  });

  it("exports all whitehouse feed URLs", () => {
    expect(config.WHITEHOUSE_FEEDS).toHaveProperty("eos");
    expect(config.WHITEHOUSE_FEEDS).toHaveProperty("briefings");
    expect(config.WHITEHOUSE_FEEDS).toHaveProperty("statements");
  });

  it("exports Polymarket and Metaculus base URLs", () => {
    expect(config.POLYMARKET_API_BASE).toContain("polymarket.com");
    expect(config.METACULUS_API_BASE).toContain("metaculus.com");
  });

  it("exports FEC base URL and default key", () => {
    expect(config.FEC_API_BASE).toContain("open.fec.gov");
    expect(config.FEC_DEFAULT_API_KEY).toBe("DEMO_KEY");
  });
});
