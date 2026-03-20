import { describe, it, expect } from "vitest";

// We can't easily test the full pipeline (it spawns Claude CLI),
// but we can test the classifyTool function by extracting its logic.
// Since it's not exported, we test it indirectly through the ProgressEvent types.

import type { ToolCategory, ProgressDetail } from "../lib/types";

// Re-implement classifyTool for testing (mirrors pipeline.ts)
function classifyTool(
  toolName: string,
  input: Record<string, unknown>,
): { detail: string; toolName: string; toolCategory: ToolCategory } {
  if (toolName === "WebSearch" || toolName === "web_search") {
    return {
      detail: `Searching: ${input.query || "..."}`,
      toolName: "WebSearch",
      toolCategory: "search",
    };
  }
  if (toolName === "Bash") {
    const cmd = (input.command as string) || "";
    if (cmd.includes("cli.ts cross-market")) {
      const q = cmd.match(/--query\s+"([^"]+)"/)?.[1] || "";
      return { detail: `Cross-market lookup: ${q}`, toolName: "cross-market", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts whitehouse")) {
      const q = cmd.match(/--search\s+"([^"]+)"/)?.[1] || "";
      return { detail: `White House search: ${q}`, toolName: "whitehouse", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts oira")) {
      const q = cmd.match(/--search\s+"([^"]+)"/)?.[1] || "";
      return { detail: `OIRA/Fed Register: ${q}`, toolName: "oira", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts fec")) {
      const who = cmd.match(/--(?:candidate|committee)\s+"([^"]+)"/)?.[1] || "";
      return { detail: `FEC lookup: ${who}`, toolName: "fec", toolCategory: "fetcher" };
    }
    if (cmd.includes("cli.ts polling")) {
      const race = cmd.match(/--race\s+"([^"]+)"/)?.[1] || "";
      return { detail: `Polling data: ${race}`, toolName: "polling", toolCategory: "fetcher" };
    }
    return { detail: `Running: ${cmd.slice(0, 80)}`, toolName: "Bash", toolCategory: "bash" };
  }
  return { detail: `Using ${toolName}...`, toolName, toolCategory: "thinking" };
}

describe("classifyTool", () => {
  it("classifies WebSearch", () => {
    const result = classifyTool("WebSearch", { query: "government shutdown 2026" });
    expect(result.toolCategory).toBe("search");
    expect(result.detail).toContain("government shutdown");
  });

  it("classifies cross-market fetcher", () => {
    const result = classifyTool("Bash", {
      command: 'npx tsx lib/fetchers/cli.ts cross-market --query "shutdown"',
    });
    expect(result.toolCategory).toBe("fetcher");
    expect(result.toolName).toBe("cross-market");
    expect(result.detail).toContain("shutdown");
  });

  it("classifies whitehouse fetcher", () => {
    const result = classifyTool("Bash", {
      command: 'npx tsx lib/fetchers/cli.ts whitehouse --search "tariff" --type eos',
    });
    expect(result.toolCategory).toBe("fetcher");
    expect(result.toolName).toBe("whitehouse");
    expect(result.detail).toContain("tariff");
  });

  it("classifies oira fetcher", () => {
    const result = classifyTool("Bash", {
      command: 'npx tsx lib/fetchers/cli.ts oira --search "EPA climate"',
    });
    expect(result.toolCategory).toBe("fetcher");
    expect(result.toolName).toBe("oira");
  });

  it("classifies fec fetcher with candidate", () => {
    const result = classifyTool("Bash", {
      command: 'npx tsx lib/fetchers/cli.ts fec --candidate "Jon Ossoff"',
    });
    expect(result.toolCategory).toBe("fetcher");
    expect(result.toolName).toBe("fec");
    expect(result.detail).toContain("Ossoff");
  });

  it("classifies fec fetcher with committee", () => {
    const result = classifyTool("Bash", {
      command: 'npx tsx lib/fetchers/cli.ts fec --committee "Save America"',
    });
    expect(result.toolCategory).toBe("fetcher");
    expect(result.detail).toContain("Save America");
  });

  it("classifies polling fetcher", () => {
    const result = classifyTool("Bash", {
      command: 'npx tsx lib/fetchers/cli.ts polling --race "Georgia Senate"',
    });
    expect(result.toolCategory).toBe("fetcher");
    expect(result.toolName).toBe("polling");
  });

  it("classifies generic Bash command", () => {
    const result = classifyTool("Bash", { command: "ls -la" });
    expect(result.toolCategory).toBe("bash");
  });

  it("classifies unknown tools as thinking", () => {
    const result = classifyTool("Read", {});
    expect(result.toolCategory).toBe("thinking");
  });
});

describe("ProgressDetail type", () => {
  it("can be constructed correctly", () => {
    const detail: ProgressDetail = {
      stage: "evidence",
      toolName: "WebSearch",
      toolCategory: "search",
      summary: "Searching: climate change",
      timestamp: Date.now(),
    };
    expect(detail.stage).toBe("evidence");
    expect(detail.toolCategory).toBe("search");
  });
});
