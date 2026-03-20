"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "kalshi-chat-sessions";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage full or unavailable
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = first.content.slice(0, 50);
  return text.length < first.content.length ? text + "..." : text;
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    if (loaded.length > 0) {
      setActiveSessionId(loaded[0].id); // most recent
    }
  }, []);

  // Persist sessions to localStorage on change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [];

  const updateSession = useCallback((id: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? updater(s) : s));
      // Sort by updatedAt descending
      updated.sort((a, b) => b.updatedAt - a.updatedAt);
      return updated;
    });
  }, []);

  const newSession = useCallback(() => {
    const session: ChatSession = {
      id: generateId(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setError(null);
    return session.id;
  }, []);

  const selectSession = useCallback((id: string) => {
    abortRef.current?.abort();
    setActiveSessionId(id);
    setStreaming(false);
    setError(null);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      saveSessions(filtered);
      return filtered;
    });
    if (activeSessionId === id) {
      setSessions((prev) => {
        setActiveSessionId(prev.length > 0 ? prev[0].id : null);
        return prev;
      });
    }
  }, [activeSessionId]);

  const send = useCallback(async (text: string, tickers: string[]) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      // Auto-create a session
      const session: ChatSession = {
        id: generateId(),
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      sessionId = session.id;
    }

    const userMsg: ChatMessage = { role: "user", content: text };

    // Get current messages for this session
    let currentMessages: ChatMessage[] = [];
    setSessions((prev) => {
      const session = prev.find((s) => s.id === sessionId);
      currentMessages = session ? [...session.messages, userMsg] : [userMsg];
      return prev;
    });
    // Small delay to ensure we have the messages
    currentMessages = [...(sessions.find((s) => s.id === sessionId)?.messages || []), userMsg];

    const newMessages = currentMessages;

    updateSession(sessionId, (s) => ({
      ...s,
      messages: newMessages,
      title: s.messages.length === 0 ? deriveTitle(newMessages) : s.title,
      updatedAt: Date.now(),
    }));

    setStreaming(true);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, tickers }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Chat request failed" }));
        setError(err.error || "Chat request failed");
        setStreaming(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      // Add placeholder assistant message
      updateSession(sessionId, (s) => ({
        ...s,
        messages: [...s.messages, { role: "assistant", content: "" }],
        updatedAt: Date.now(),
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "delta") {
              assistantText += event.text;
              const finalText = assistantText;
              updateSession(sessionId, (s) => {
                const msgs = [...s.messages];
                msgs[msgs.length - 1] = { role: "assistant", content: finalText };
                return { ...s, messages: msgs, updatedAt: Date.now() };
              });
            } else if (event.type === "done") {
              assistantText = event.text;
              const finalText = assistantText;
              updateSession(sessionId, (s) => {
                const msgs = [...s.messages];
                msgs[msgs.length - 1] = { role: "assistant", content: finalText };
                return { ...s, messages: msgs, updatedAt: Date.now() };
              });
            } else if (event.type === "error") {
              setError(event.text);
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [activeSessionId, sessions, updateSession]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    if (activeSessionId) {
      deleteSession(activeSessionId);
    }
    setError(null);
    setStreaming(false);
  }, [activeSessionId, deleteSession]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return {
    messages,
    streaming,
    error,
    send,
    clear,
    stop,
    sessions,
    activeSessionId,
    newSession,
    selectSession,
    deleteSession,
  };
}
