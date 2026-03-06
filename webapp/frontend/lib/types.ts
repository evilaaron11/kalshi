export type MarketType = "binary" | "event";

export interface OutcomeSummary {
  ticker: string;
  title: string;
  yes_price: number | null;
}

export interface MarketSummary {
  ticker: string;
  title: string;
  market_type: MarketType;
  yes_price: number | null;
  no_price: number | null;
  volume: number;
  close_date: string;
  status: string;
  outcomes: OutcomeSummary[] | null;
  sub_threshold_count: number;
}

export type PipelineStage =
  | "fetch"
  | "evidence"
  | "devil_advocate"
  | "resolution"
  | "chaos"
  | "calibrator";

export type StageStatus = "pending" | "running" | "complete" | "error";

export interface StageEvent {
  stage: PipelineStage;
  status: StageStatus;
  duration_s: number | null;
  detail: string | null;
}

export interface CompleteEvent {
  run_id: string;
  report_path: string;
}

export interface RunState {
  run_id: string;
  stages: Record<PipelineStage, { status: StageStatus; duration_s?: number }>;
  detail: string | null;
  report_path: string | null;
  error: string | null;
}
