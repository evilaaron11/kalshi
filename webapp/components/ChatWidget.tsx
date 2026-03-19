"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@/lib/useChat";
import RichText from "./RichText";

export interface MarketInfo {
  ticker: string;
  title: string;
}

interface Props {
  markets: MarketInfo[];
}

export default function ChatWidget({ markets }: Props) {
  const [open, setOpen] = useState(false);
  const { messages, streaming, error, send, clear, stop } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tickers = markets.map((m) => m.ticker);
  const hasMarkets = markets.length > 0;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming || !hasMarkets) return;
    setInput("");
    send(text, tickers);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat panel */}
      {open && (
        <div className="mb-3 w-96 h-[520px] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/95">
            <div>
              <div className="text-sm font-medium text-neutral-200">Analysis Chat</div>
              <div className="text-xs text-neutral-500 truncate max-w-[240px]">
                {hasMarkets ? `${markets.length} market${markets.length > 1 ? "s" : ""} loaded` : "No markets"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-neutral-300 text-lg leading-none"
              >
                {"\u2715"}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {!hasMarkets && (
              <div className="text-sm text-neutral-500 text-center py-8">
                Add markets to chat about their analysis.
              </div>
            )}

            {hasMarkets && messages.length === 0 && !streaming && (
              <div className="text-center py-6 space-y-3">
                <div className="text-sm text-neutral-400">
                  Ask anything about this analysis.
                </div>
                <div className="space-y-1.5">
                  {[
                    "What's the strongest bull case?",
                    "Explain the edge calculation",
                    "What are the key risks?",
                    "Summarize the betting recommendation",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(""); send(q, tickers); }}
                      className="block w-full text-left px-3 py-1.5 text-xs text-neutral-400 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-neutral-800 text-neutral-300 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <RichText text={msg.content || "\u2026"} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {streaming && messages[messages.length - 1]?.role === "assistant" && (
              <div className="flex justify-start">
                <button
                  onClick={stop}
                  className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1"
                >
                  Stop generating
                </button>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 text-center py-1">{error}</div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-800">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={hasMarkets ? "Ask about your markets..." : "Add markets first"}
                disabled={!hasMarkets || streaming}
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || streaming || !hasMarkets}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {"\u2191"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FAB toggle */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg transition-all ${
          open
            ? "bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {open ? "\u2715" : "\uD83D\uDCAC"}
      </button>
    </div>
  );
}
