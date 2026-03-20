import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock fs to avoid touching real watchlist
vi.mock("fs");

const WATCHLIST_PATH = path.join(process.cwd(), "data", "watchlist.json");

describe("watchlist", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadWatchlist returns empty array when file doesn't exist", async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { loadWatchlist } = await import("../lib/watchlist");
    expect(loadWatchlist()).toEqual([]);
  });

  it("loadWatchlist parses existing JSON", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('["KXGOV", "KXFED"]');
    const { loadWatchlist } = await import("../lib/watchlist");
    expect(loadWatchlist()).toEqual(["KXGOV", "KXFED"]);
  });

  it("addToWatchlist appends new ticker", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('["KXGOV"]');
    const { addToWatchlist } = await import("../lib/watchlist");
    const result = addToWatchlist("KXFED");
    expect(result).toEqual(["KXGOV", "KXFED"]);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("addToWatchlist does not duplicate existing ticker", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('["KXGOV"]');
    const { addToWatchlist } = await import("../lib/watchlist");
    const result = addToWatchlist("KXGOV");
    expect(result).toEqual(["KXGOV"]);
  });

  it("removeFromWatchlist removes ticker", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('["KXGOV", "KXFED"]');
    const { removeFromWatchlist } = await import("../lib/watchlist");
    const result = removeFromWatchlist("KXGOV");
    expect(result).toEqual(["KXFED"]);
  });
});
