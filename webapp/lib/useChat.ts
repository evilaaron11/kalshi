"use client";

import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string, tickers: string[]) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
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
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantText };
                return updated;
              });
            } else if (event.type === "done") {
              // Use final result text
              assistantText = event.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantText };
                return updated;
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
  }, [messages]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStreaming(false);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { messages, streaming, error, send, clear, stop };
}
