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
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onAdd(url.trim());
      setUrl("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add market");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Add Market</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-neutral-400 mb-3">
          Paste a Kalshi market or event URL:
        </p>

        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="https://kalshi.com/markets/..."
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-blue-500 mb-2"
        />

        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

        <p className="text-xs text-neutral-600 mb-4">
          Type auto-detected from URL.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
