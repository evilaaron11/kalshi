"use client";

import { useCallback, useRef, useState } from "react";
import type {
  StageEvent,
  CompleteEvent,
  ProgressEvent,
  ProgressDetail,
} from "./types";

export interface RunState {
  runId: string | null;
  stages: Record<string, StageEvent>;
  /** Full progress history per stage */
  progressHistory: Record<string, ProgressDetail[]>;
  /** Latest progress detail string per stage (for one-liner display) */
  latestProgress: Record<string, string>;
  complete: CompleteEvent | null;
  error: string | null;
}

const INITIAL: RunState = {
  runId: null,
  stages: {},
  progressHistory: {},
  latestProgress: {},
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
        error:
          data.status === "error"
            ? data.detail || "Unknown error"
            : prev.error,
      }));
    });

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data) as ProgressEvent;
      const detail: ProgressDetail = {
        stage: data.stage,
        toolName: data.toolName || "tool",
        toolCategory: data.toolCategory || "thinking",
        summary: data.detail,
        timestamp: data.timestamp || Date.now(),
      };

      setRunState((prev) => {
        const existing = prev.progressHistory[data.stage] || [];
        return {
          ...prev,
          progressHistory: {
            ...prev.progressHistory,
            [data.stage]: [...existing, detail],
          },
          latestProgress: {
            ...prev.latestProgress,
            [data.stage]: data.detail,
          },
        };
      });
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
