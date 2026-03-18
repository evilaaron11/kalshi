import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import path from "path";

const CLI_PATH = path.resolve(__dirname, "../lib/fetchers/cli.ts");
const WEBAPP_DIR = path.resolve(__dirname, "..");

function runCli(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync("npx", ["tsx", CLI_PATH, ...args], {
      cwd: WEBAPP_DIR,
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env },
      shell: true,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout || e.stderr || "", exitCode: e.status || 1 };
  }
}

describe("fetcher CLI", () => {
  it("exits with error when no command given", () => {
    const { exitCode } = runCli([]);
    expect(exitCode).not.toBe(0);
  });

  it("exits with error for unknown command", () => {
    const { exitCode } = runCli(["unknown-command"]);
    expect(exitCode).not.toBe(0);
  });

  it("cross-market requires --query", () => {
    const { exitCode, stdout } = runCli(["cross-market"]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("--query is required");
  });

  it("whitehouse requires --search", () => {
    const { exitCode, stdout } = runCli(["whitehouse"]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("--search is required");
  });

  it("fec requires --candidate or --committee", () => {
    const { exitCode, stdout } = runCli(["fec"]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("--candidate or --committee is required");
  });

  it("polling requires --race", () => {
    const { exitCode, stdout } = runCli(["polling"]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("--race is required");
  });

  it("cross-market returns valid JSON array", () => {
    const { stdout, exitCode } = runCli([
      "cross-market",
      "--query",
      "government shutdown",
    ]);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
  }, 30_000);

  it("fec returns candidate data", () => {
    const { stdout, exitCode } = runCli([
      "fec",
      "--candidate",
      "Jon Ossoff",
      "--office",
      "S",
    ]);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
  }, 30_000);
});
