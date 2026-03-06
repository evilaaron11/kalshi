"use client";

import { useCallback, useRef, useState } from "react";
import { sseUrl, startAnalysis, cancelAnalysis } from "./api";
import type { PipelineStage, RunState, StageEvent } from "./types";

const INITIAL_STAGES: RunState["stages"] = {
  fetch: { status: "pending" },
  evidence: { status: "pending" },
  devil_advocate: { status: "pending" },
  resolution: { status: "pending" },
  chaos: { status: "pending" },
  calibrator: { status: "pending" },
};

export function useAnalysis() {
  const [runState, setRunState] = useState<RunState | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const start = useCallback(async (ticker: string) => {
    const { run_id } = await startAnalysis(ticker);

    setRunState({
      run_id,
      stages: { ...INITIAL_STAGES },
      detail: null,
      report_path: null,
      error: null,
    });

    const es = new EventSource(sseUrl(run_id));
    eventSourceRef.current = es;

    es.addEventListener("stage", (e) => {
      const data: StageEvent = JSON.parse(e.data);
      setRunState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stages: {
            ...prev.stages,
            [data.stage]: {
              status: data.status,
              ...(data.duration_s != null ? { duration_s: data.duration_s } : {}),
            },
          },
          detail: data.detail || prev.detail,
          error: data.status === "error" ? data.detail : prev.error,
        };
      });
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setRunState((prev) =>
        prev ? { ...prev, report_path: data.report_path } : prev
      );
      es.close();
    });

    es.onerror = () => {
      es.close();
      setRunState((prev) =>
        prev ? { ...prev, error: prev.error || "Connection lost" } : prev
      );
    };
  }, []);

  const cancel = useCallback(async () => {
    if (runState?.run_id) {
      await cancelAnalysis(runState.run_id);
    }
    eventSourceRef.current?.close();
    setRunState(null);
  }, [runState]);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    setRunState(null);
  }, []);

  return { runState, start, cancel, reset };
}
