// --- Market types ---

export type MarketType = "binary" | "event";

export interface MarketSummary {
  ticker: string;
  title: string;
  marketType: MarketType;
  yesPrice?: number; // 0–1
  noPrice?: number;
  yesBid?: number;
  volume: number;
  openInterest?: number;
  closeDate: string;
  status: string;
  seriesTicker?: string;
  eventTitle?: string;
  // Event-specific
  outcomes?: OutcomeSummary[];
  subThresholdCount: number;
}

export interface OutcomeSummary {
  ticker: string;
  title: string;
  yesPrice?: number;
}

export interface ParsedMarket {
  ticker: string;
  title: string;
  subtitle: string;
  yesSubTitle: string;
  resolutionCriteria: string;
  eventTicker: string;
  yesPrice: number;
  noPrice: number;
  yesBid: number;
  volume: number;
  openInterest: number;
  closeDate: string;
  status: string;
  seriesTicker?: string;
  eventTitle?: string;
}

export interface EventData {
  type: "event";
  title: string;
  seriesTicker: string;
  eventTitle: string;
  markets: ParsedMarket[];
  subThresholdMarkets: ParsedMarket[];
}

export type MarketData = ParsedMarket | EventData;

export function isEventData(data: MarketData): data is EventData {
  return "type" in data && data.type === "event";
}

// --- Pipeline types ---

export type PipelineStage =
  | "fetch"
  | "evidence"
  | "devil_advocate"
  | "resolution"
  | "chaos"
  | "calibrator";

export type StageStatus = "pending" | "running" | "complete" | "error";

export interface StageEvent {
  kind: "stage";
  stage: PipelineStage;
  status: StageStatus;
  durationS?: number;
  detail?: string;
}

export interface ProgressEvent {
  kind: "progress";
  stage: PipelineStage;
  detail: string;
}

export interface CompleteEvent {
  kind: "complete";
  runId: string;
  reportPath: string;
}

export type PipelineEvent = StageEvent | ProgressEvent | CompleteEvent;

export interface RunInfo {
  runId: string;
  ticker: string;
  startedAt: string;
}

// --- API request/response ---

export interface AddMarketRequest {
  url: string;
}

export interface AnalyzeRequest {
  ticker: string;
}

// --- Fetcher output types ---

export interface CrossMarketResult {
  platform: string;
  title: string;
  probability: number;
  volume?: number;
  forecasters?: number;
  url: string;
}

export interface FecCandidate {
  name: string;
  party: string;
  office: string;
  state: string;
  district: string;
  cycle: number;
  cashOnHand: number;
  totalRaised: number;
  totalSpent: number;
  burnRate: number;
  coverageDate: string;
  candidateId: string;
  source: "fec";
}

export interface FecCommittee {
  name: string;
  committeeId: string;
  type: string;
  designation: string;
  cashOnHand: number;
  totalReceipts: number;
  totalDisbursements: number;
  coverageDate: string;
  source: "fec";
}
