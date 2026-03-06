const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchMarkets() {
  const res = await fetch(`${API_BASE}/api/markets`);
  if (!res.ok) throw new Error(`Failed to fetch markets: ${res.status}`);
  return res.json();
}

export async function addMarket(url: string) {
  const res = await fetch(`${API_BASE}/api/markets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to add market: ${res.status}`);
  }
  return res.json();
}

export async function removeMarket(ticker: string) {
  const res = await fetch(`${API_BASE}/api/markets/${ticker}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove market: ${res.status}`);
  return res.json();
}

export async function startAnalysis(ticker: string) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
  if (!res.ok) throw new Error(`Failed to start analysis: ${res.status}`);
  return res.json();
}

export async function cancelAnalysis(runId: string) {
  const res = await fetch(`${API_BASE}/api/analyze/${runId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to cancel: ${res.status}`);
  return res.json();
}

export function sseUrl(runId: string) {
  return `${API_BASE}/api/analyze/${runId}/sse`;
}
