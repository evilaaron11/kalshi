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

export type ToolCategory = "search" | "fetcher" | "bash" | "thinking" | "reasoning";

export interface ProgressEvent {
  kind: "progress";
  stage: PipelineStage;
  detail: string;
  toolName?: string;
  toolCategory?: ToolCategory;
  timestamp?: number;
}

export interface ProgressDetail {
  stage: PipelineStage;
  toolName: string;
  toolCategory: ToolCategory;
  summary: string;
  timestamp: number;
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

// --- Congress.gov types ---

export interface CongressBill {
  billId: string;
  number: string;
  title: string;
  type: string;
  congress: number;
  introducedDate: string;
  latestAction: string;
  latestActionDate: string;
  sponsor: string;
  sponsorParty: string;
  cosponsorCount: number;
  committees: string[];
  status: string;
  source: "congress.gov";
}

export interface CongressBillDetail extends CongressBill {
  actions: { date: string; text: string }[];
  cosponsors: { name: string; party: string; state: string }[];
  relatedBills: { billId: string; title: string }[];
  cboUrl?: string;
}

export interface FloorAction {
  chamber: "House" | "Senate";
  date: string;
  billNumber?: string;
  description: string;
  source: "congress.gov";
}

// --- FRED types ---

export interface FredObservation {
  date: string;
  value: number;
}

export interface FredSeries {
  seriesId: string;
  title: string;
  frequency: string;
  units: string;
  lastUpdated: string;
  observations?: FredObservation[];
  source: "fred";
}

export interface FredRelease {
  seriesId: string;
  releaseName: string;
  releaseDate: string;
  source: "fred";
}

// --- Confirmation types ---

export interface ConfirmationRecord {
  nominee: string;
  position: string;
  president: string;
  yearNominated: number;
  yearResolved: number;
  outcome: "confirmed" | "withdrawn" | "rejected";
  daysToResolution: number;
  senateVoteMargin?: number;
  committeeVote?: string;
  source: "historical";
}

export interface ConfirmationBaseRates {
  position: string;
  confirmationRate: number;
  avgDays: number;
  avgMargin: number | null;
  totalCount: number;
}

export interface RecessAppointment {
  president: string;
  nominee: string;
  position: string;
  date: string;
  context: string;
  source: "historical";
}

// --- Cook PVI types ---

export interface PviRecord {
  state: string;
  district?: number;
  pviScore: string;
  leanDirection: "R" | "D" | "EVEN";
  leanMagnitude: number;
  incumbent?: string;
  incumbentParty?: string;
  chamber: "House" | "Senate";
  source: "cook-pvi";
}

// --- Senate / ProPublica types ---

export interface Senator {
  name: string;
  party: "R" | "D" | "I";
  state: string;
  memberId: string;
  nextElection: number;
  source: "congress.gov";
}

export interface NominationVote {
  voteId: string;
  description: string;
  result: string;
  date: string;
  yesVotes: number;
  noVotes: number;
  notVoting: number;
  source: "senate.gov";
}

export interface WhipEstimate {
  nomineeType: string;
  estimatedYes: number;
  estimatedNo: number;
  estimatedUncertain: number;
  swingSenators: { name: string; party: string; state: string; likelihood: string }[];
  source: "congress.gov";
}
