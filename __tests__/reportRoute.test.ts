import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// We test the route handler logic by importing it directly
// Mock fs to avoid touching real filesystem
vi.mock("fs");

const mockFs = vi.mocked(fs);

// Import after mocking
const { GET } = await import("@/app/api/markets/[ticker]/report/route");

function makeRequest(url: string): Request {
  return new Request(url);
}

function makeParams(ticker: string) {
  return { params: Promise.resolve({ ticker }) };
}

describe("GET /api/markets/[ticker]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue("/project");
  });

  it("returns 404 when results dir does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const res = await GET(
      makeRequest("http://localhost/api/markets/KXFOO/report"),
      makeParams("KXFOO"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when no matching files exist", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([] as unknown as fs.Dirent[]);
    const res = await GET(
      makeRequest("http://localhost/api/markets/KXFOO/report"),
      makeParams("KXFOO"),
    );
    expect(res.status).toBe(404);
  });

  it("returns latest report by default", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "2026-03-18_1400_KXFOO.md",
      "2026-03-19_0900_KXFOO.md",
      "2026-03-19_1500_KXFOO.md",
    ] as unknown as fs.Dirent[]);
    mockFs.readFileSync.mockReturnValue("# Latest report content");

    const res = await GET(
      makeRequest("http://localhost/api/markets/KXFOO/report"),
      makeParams("KXFOO"),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("# Latest report content");
    // Should read the newest file (sorted reverse)
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join("/project", "results", "2026-03-19_1500_KXFOO.md"),
      "utf-8",
    );
  });

  it("returns report list when ?all=true", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "2026-03-18_1400_KXFOO.md",
      "2026-03-19_0900_KXFOO.md",
    ] as unknown as fs.Dirent[]);

    const res = await GET(
      makeRequest("http://localhost/api/markets/KXFOO/report?all=true"),
      makeParams("KXFOO"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    // Newest first
    expect(data[0].filename).toBe("2026-03-19_0900_KXFOO.md");
    expect(data[0].date).toBe("2026-03-19");
    expect(data[0].time).toBe("09:00");
    expect(data[1].filename).toBe("2026-03-18_1400_KXFOO.md");
    expect(data[1].date).toBe("2026-03-18");
    expect(data[1].time).toBe("14:00");
  });

  it("returns specific report when ?file= is provided", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "2026-03-18_1400_KXFOO.md",
      "2026-03-19_0900_KXFOO.md",
    ] as unknown as fs.Dirent[]);
    mockFs.readFileSync.mockReturnValue("# Older report");

    const res = await GET(
      makeRequest("http://localhost/api/markets/KXFOO/report?file=2026-03-18_1400_KXFOO.md"),
      makeParams("KXFOO"),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("# Older report");
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join("/project", "results", "2026-03-18_1400_KXFOO.md"),
      "utf-8",
    );
  });

  it("returns 404 for nonexistent specific file", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "2026-03-19_0900_KXFOO.md",
    ] as unknown as fs.Dirent[]);

    const res = await GET(
      makeRequest("http://localhost/api/markets/KXFOO/report?file=nonexistent.md"),
      makeParams("KXFOO"),
    );
    expect(res.status).toBe(404);
  });

  it("is case-insensitive for ticker matching", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "2026-03-19_0900_KXFOO.md",
    ] as unknown as fs.Dirent[]);
    mockFs.readFileSync.mockReturnValue("# Report");

    const res = await GET(
      makeRequest("http://localhost/api/markets/kxfoo/report"),
      makeParams("kxfoo"),
    );
    expect(res.status).toBe(200);
  });
});
