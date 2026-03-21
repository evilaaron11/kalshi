import { getJson } from "../httpClient";
import {
  FEC_API_BASE,
  FEC_DEFAULT_API_KEY,
  FEC_REQUEST_TIMEOUT,
  FEC_PER_PAGE_LIMIT,
} from "../config";
import type { FecCandidate, FecCommittee } from "../types";

function getApiKey(): string {
  return process.env.DATA_GOV_API_KEY || process.env.FEC_API_KEY || FEC_DEFAULT_API_KEY;
}

export async function searchCandidates(opts: {
  name: string;
  office?: string; // P, S, H
  state?: string;
  cycle?: number;
  limit?: number;
}): Promise<FecCandidate[]> {
  const params: Record<string, string> = {
    api_key: getApiKey(),
    q: opts.name,
    sort: "-receipts",
    per_page: String(opts.limit || FEC_PER_PAGE_LIMIT),
  };
  if (opts.office) params.office = opts.office;
  if (opts.state) params.state = opts.state;
  if (opts.cycle) params.cycle = String(opts.cycle);

  const data = await getJson<{ results: Record<string, unknown>[] }>(
    `${FEC_API_BASE}/candidates/totals/`,
    { params, timeout: FEC_REQUEST_TIMEOUT },
  );
  if (!data?.results) return [];

  const officeMap: Record<string, string> = { P: "President", S: "Senate", H: "House" };

  return data.results.map((c) => {
    const raised = (c.receipts as number) || 0;
    const spent = (c.disbursements as number) || 0;
    return {
      name: (c.name as string) || "",
      party: (c.party as string) || "",
      office: officeMap[(c.office as string) || ""] || (c.office as string) || "",
      state: (c.state as string) || "",
      district: (c.district as string) || "",
      cycle: (c.cycle as number) || 0,
      cashOnHand: (c.last_cash_on_hand_end_period as number) || 0,
      totalRaised: raised,
      totalSpent: spent,
      burnRate: raised > 0 ? Math.round((spent / raised) * 100) / 100 : 0,
      coverageDate: (c.coverage_end_date as string) || "",
      candidateId: (c.candidate_id as string) || "",
      source: "fec",
    };
  });
}

export async function searchCommittees(opts: {
  name: string;
  limit?: number;
}): Promise<FecCommittee[]> {
  const params: Record<string, string> = {
    api_key: getApiKey(),
    q: opts.name,
    sort: "-last_cash_on_hand_end_period",
    per_page: String(opts.limit || FEC_PER_PAGE_LIMIT),
  };

  const data = await getJson<{ results: Record<string, unknown>[] }>(
    `${FEC_API_BASE}/committees/`,
    { params, timeout: FEC_REQUEST_TIMEOUT },
  );
  if (!data?.results) return [];

  return data.results.map((c) => ({
    name: (c.name as string) || "",
    committeeId: (c.committee_id as string) || "",
    type: (c.committee_type_full as string) || "",
    designation: (c.designation_full as string) || "",
    cashOnHand: (c.last_cash_on_hand_end_period as number) || 0,
    totalReceipts: (c.last_total_receipts as number) || 0,
    totalDisbursements: (c.last_total_disbursements as number) || 0,
    coverageDate: (c.last_coverage_end_date as string) || "",
    source: "fec",
  }));
}
