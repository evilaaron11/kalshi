"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketSummary } from "@/lib/types";
import { useAnalysis } from "@/lib/useAnalysis";
import MarketCard from "@/components/MarketCard";
import AddMarketModal from "@/components/AddMarketModal";
import ChatWidget, { type MarketInfo } from "@/components/ChatWidget";

export default function Dashboard() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { runState, start, cancel, reset } = useAnalysis();
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
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

  const handleReorder = useCallback(async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setMarkets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      // Persist order in background
      fetch("/api/markets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: next.map((m) => m.ticker) }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const handleAnalyze = async (ticker: string) => {
    reset();
    setActiveTicker(ticker);
    await start(ticker);
  };

  const chatMarkets: MarketInfo[] = markets.map((m) => ({
    ticker: m.ticker,
    title: m.title,
  }));

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

        {markets.map((m, i) => (
          <div
            key={m.ticker}
            draggable
            onDragStart={(e) => {
              dragIdx.current = i;
              e.dataTransfer.effectAllowed = "move";
              // Make drag preview semi-transparent
              if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = "0.5";
              }
            }}
            onDragEnd={(e) => {
              if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = "1";
              }
              dragIdx.current = null;
              setDragOverIdx(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverIdx(i);
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx.current !== null) {
                handleReorder(dragIdx.current, i);
              }
              setDragOverIdx(null);
            }}
            className={`transition-all ${
              dragOverIdx === i && dragIdx.current !== null && dragIdx.current !== i
                ? "border-t-2 border-blue-500 pt-1"
                : ""
            }`}
          >
            <MarketCard
              market={m}
              runState={activeTicker === m.ticker ? runState : null}
              onAnalyze={() => handleAnalyze(m.ticker)}
              onCancel={cancel}
              onRemove={() => handleRemove(m.ticker)}
              onReportToggle={() => {}}
            />
          </div>
        ))}
      </main>

      <AddMarketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
      />

      <ChatWidget markets={chatMarkets} />
    </div>
  );
}
