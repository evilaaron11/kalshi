import { describe, it, expect, beforeEach, vi } from "vitest";

// Test the localStorage persistence logic used by useChat
// We extract and test the pure functions

const STORAGE_KEY = "kalshi-chat-sessions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

function loadSessions(storage: Record<string, string>): ChatSession[] {
  try {
    const raw = storage[STORAGE_KEY];
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSessions(storage: Record<string, string>, sessions: ChatSession[]) {
  storage[STORAGE_KEY] = JSON.stringify(sessions);
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = first.content.slice(0, 50);
  return text.length < first.content.length ? text + "..." : text;
}

describe("Chat session persistence", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
  });

  it("returns empty array when no sessions stored", () => {
    expect(loadSessions(storage)).toEqual([]);
  });

  it("returns empty array for corrupt data", () => {
    storage[STORAGE_KEY] = "not json";
    expect(loadSessions(storage)).toEqual([]);
  });

  it("round-trips sessions through save/load", () => {
    const sessions: ChatSession[] = [
      {
        id: "abc123",
        title: "Test chat",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];
    saveSessions(storage, sessions);
    const loaded = loadSessions(storage);
    expect(loaded).toEqual(sessions);
    expect(loaded[0].messages).toHaveLength(2);
  });

  it("preserves multiple sessions", () => {
    const sessions: ChatSession[] = [
      { id: "a", title: "First", messages: [], createdAt: 1000, updatedAt: 3000 },
      { id: "b", title: "Second", messages: [], createdAt: 2000, updatedAt: 2000 },
    ];
    saveSessions(storage, sessions);
    const loaded = loadSessions(storage);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe("a");
    expect(loaded[1].id).toBe("b");
  });
});

describe("deriveTitle", () => {
  it("returns 'New chat' for empty messages", () => {
    expect(deriveTitle([])).toBe("New chat");
  });

  it("returns 'New chat' when no user message", () => {
    expect(deriveTitle([{ role: "assistant", content: "Hi" }])).toBe("New chat");
  });

  it("uses first user message as title", () => {
    expect(deriveTitle([
      { role: "user", content: "What is the edge?" },
    ])).toBe("What is the edge?");
  });

  it("truncates long messages at 50 chars with ellipsis", () => {
    const long = "A".repeat(60);
    const title = deriveTitle([{ role: "user", content: long }]);
    expect(title).toBe("A".repeat(50) + "...");
  });

  it("does not add ellipsis for exactly 50 chars", () => {
    const exact = "B".repeat(50);
    const title = deriveTitle([{ role: "user", content: exact }]);
    expect(title).toBe(exact);
  });
});
