"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (url: string) => Promise<void>;
}

export default function AddMarketModal({ open, onClose, onAdd }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onAdd(url);
      setUrl("");
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-neutral-100">
            Add Market
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            &times;
          </button>
        </div>

        <label className="block text-sm text-neutral-400 mb-2">
          Paste a Kalshi market or event URL:
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://kalshi.com/markets/..."
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-neutral-200 text-sm focus:outline-none focus:border-blue-500 mb-2"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || loading}
            className="px-3 py-1 text-sm bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
