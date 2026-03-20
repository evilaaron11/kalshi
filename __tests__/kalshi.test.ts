import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Generate a throwaway RSA key for test auth signatures
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const testPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

// Mock fs.readFileSync to return test key when loading private key
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: (p: string, enc?: string) => {
        if (typeof p === "string" && p.endsWith(".pem")) return testPem;
        return actual.readFileSync(p, enc as BufferEncoding);
      },
      existsSync: actual.existsSync,
      mkdirSync: actual.mkdirSync,
      writeFileSync: actual.writeFileSync,
    },
    readFileSync: (p: string, enc?: string) => {
      if (typeof p === "string" && p.endsWith(".pem")) return testPem;
      return actual.readFileSync(p, enc as BufferEncoding);
    },
  };
});

// Set env vars for auth
process.env.KALSHI_API_KEY = "test-key";
process.env.KALSHI_PRIVATE_KEY_PATH = "./test.pem";

import { parseTicker } from "../lib/kalshi";

describe("parseTicker", () => {
  it("returns uppercase ticker as-is", () => {
    expect(parseTicker("KXGOV-SHUTDOWN")).toBe("KXGOV-SHUTDOWN");
  });

  it("uppercases lowercase ticker", () => {
    expect(parseTicker("kxgov-shutdown")).toBe("KXGOV-SHUTDOWN");
  });

  it("extracts ticker from short Kalshi URL", () => {
    expect(
      parseTicker("https://kalshi.com/markets/KXGOV-SHUTDOWN"),
    ).toBe("KXGOV-SHUTDOWN");
  });

  it("extracts ticker from long Kalshi URL with event slug", () => {
    expect(
      parseTicker(
        "https://kalshi.com/markets/event/government-shutdown/KXGOV-SHUTDOWN",
      ),
    ).toBe("KXGOV-SHUTDOWN");
  });

  it("trims whitespace", () => {
    expect(parseTicker("  KXFED-RATE  ")).toBe("KXFED-RATE");
  });
});

describe("parseMarketResponse (via dollarsToProbability)", () => {
  // We test the internal parsing indirectly by importing and calling fetchMarket
  // with mocked fetch responses, since parseMarketResponse is not exported.

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("parses new API format with _dollars fields", async () => {
    // Dynamic import to get fetchMarket after mocks are set up
    const { fetchMarket } = await import("../lib/kalshi");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        market: {
          ticker: "TEST-123",
          title: "Test Market",
          subtitle: "",
          yes_sub_title: "",
          rules_primary: "Resolves YES if...",
          rules_secondary: "",
          event_ticker: "",
          yes_ask_dollars: "0.6500",
          no_ask_dollars: "0.3800",
          yes_bid_dollars: "0.6200",
          last_price_dollars: "0.6300",
          volume_fp: "1234.00",
          open_interest_fp: "567.00",
          close_time: "2026-04-01T00:00:00Z",
          status: "active",
        },
      }),
    });

    const result = await fetchMarket("TEST-123");

    // Should not be an event
    expect("type" in result && result.type === "event").toBe(false);

    // Check parsed values — dollars should map directly to probabilities
    const market = result as {
      yesPrice: number;
      noPrice: number;
      yesBid: number;
      volume: number;
      openInterest: number;
    };
    expect(market.yesPrice).toBe(0.65);
    expect(market.noPrice).toBe(0.38);
    expect(market.yesBid).toBe(0.62);
    expect(market.volume).toBe(1234);
    expect(market.openInterest).toBe(567);
  });
});
