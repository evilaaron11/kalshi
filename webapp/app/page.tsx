"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketSummary } from "@/lib/types";
import { useAnalysis } from "@/lib/useAnalysis";
import MarketCard from "@/components/MarketCard";
import AddMarketModal from "@/components/AddMarketModal";
import ChatWidget from "@/components/ChatWidget";

export default function Dashboard() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { runState, start, cancel, reset } = useAnalysis();
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [viewingTicker, setViewingTicker] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch("/api/markets");
      if (resp.ok) setMarkets(await resp.json());
    } catch {
      // Markets stay stale on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (url: string) => {
    await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    await refresh();
  };

  const handleRemove = async (ticker: string) => {
    await fetch(`/api/markets/${ticker}`, { method: "DELETE" });
    setMarkets((prev) => prev.filter((m) => m.ticker !== ticker));
  };

  const handleAnalyze = async (ticker: string) => {
    reset();
    setActiveTicker(ticker);
    await start(ticker);
  };

  // Track which market has its report open for the chatbot
  const chatTicker = viewingTicker || activeTicker;

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">KALSHI ANALYST</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-1 text-sm bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
        >
          + Add
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="text-center text-neutral-500 py-12">
            Loading markets...
          </div>
        )}

        {!loading && markets.length === 0 && (
          <div className="text-center text-neutral-500 py-12">
            No markets tracked yet. Click{" "}
            <strong className="text-neutral-300">+ Add</strong> to get started.
          </div>
        )}

        {markets.map((m) => (
          <MarketCard
            key={m.ticker}
            market={m}
            runState={activeTicker === m.ticker ? runState : null}
            onAnalyze={() => handleAnalyze(m.ticker)}
            onCancel={cancel}
            onRemove={() => handleRemove(m.ticker)}
            onReportToggle={(open) => setViewingTicker(open ? m.ticker : null)}
          />
        ))}
      </main>

      <AddMarketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
      />

      <ChatWidget ticker={chatTicker} />
    </div>
  );
}
