"use client";

import { useCallback, useRef, useState } from "react";
import type { StageEvent, CompleteEvent, ProgressEvent } from "./types";

export interface RunState {
  runId: string | null;
  stages: Record<string, StageEvent>;
  /** Latest progress detail per stage (e.g. "Searching: climate 2 degrees") */
  progress: Record<string, string>;
  complete: CompleteEvent | null;
  error: string | null;
}

const INITIAL: RunState = {
  runId: null,
  stages: {},
  progress: {},
  complete: null,
  error: null,
};

export function useAnalysis() {
  const [runState, setRunState] = useState<RunState>(INITIAL);
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(async (ticker: string) => {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    if (!resp.ok) throw new Error("Failed to start analysis");
    const { runId } = await resp.json();

    setRunState({ ...INITIAL, runId });

    const es = new EventSource(`/api/analyze/${runId}/sse`);
    esRef.current = es;

    es.addEventListener("stage", (e) => {
      const data = JSON.parse(e.data) as StageEvent;
      setRunState((prev) => ({
        ...prev,
        stages: { ...prev.stages, [data.stage]: data },
        error: data.status === "error" ? data.detail || "Unknown error" : prev.error,
      }));
    });

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data) as ProgressEvent;
      setRunState((prev) => ({
        ...prev,
        progress: { ...prev.progress, [data.stage]: data.detail },
      }));
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data) as CompleteEvent;
      setRunState((prev) => ({ ...prev, complete: data }));
      es.close();
    });

    es.onerror = () => {
      es.close();
    };
  }, []);

  const cancel = useCallback(async () => {
    if (runState.runId) {
      await fetch(`/api/analyze/${runState.runId}/cancel`, { method: "POST" });
    }
    esRef.current?.close();
  }, [runState.runId]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setRunState(INITIAL);
  }, []);

  return { runState, start, cancel, reset };
}
