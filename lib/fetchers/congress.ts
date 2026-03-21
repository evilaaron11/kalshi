import { getJson, getText } from "../httpClient";
import {
  CONGRESS_API_BASE,
  CONGRESS_REQUEST_TIMEOUT,
  CONGRESS_PER_PAGE_LIMIT,
} from "../config";
import type { CongressBill, CongressBillDetail, FloorAction } from "../types";

// Current congress number — update every two years
const CURRENT_CONGRESS = 119;

function getApiKey(): string | null {
  return process.env.CONGRESS_API_KEY || null;
}

/**
 * Build base query params including the API key.
 * Returns null if no key is configured.
 */
function baseParams(): Record<string, string> | null {
  const key = getApiKey();
  if (!key) return null;
  return { api_key: key, format: "json" };
}

/**
 * Parse a bill ID string like "hr1234", "s5678", "hjres12", "sconres99" into
 * its constituent parts understood by the Congress.gov API.
 */
function parseBillId(billId: string): { type: string; number: string } | null {
  const normalized = billId.trim().toLowerCase();
  // Order matters — longer prefixes must come before shorter ones
  const prefixes = [
    { prefix: "hjres", type: "hjres" },
    { prefix: "sjres", type: "sjres" },
    { prefix: "hconres", type: "hconres" },
    { prefix: "sconres", type: "sconres" },
    { prefix: "hres", type: "hres" },
    { prefix: "sres", type: "sres" },
    { prefix: "hr", type: "hr" },
    { prefix: "s", type: "s" },
  ];
  for (const { prefix, type } of prefixes) {
    if (normalized.startsWith(prefix)) {
      const number = normalized.slice(prefix.length).replace(/\D/g, "");
      if (number) return { type, number };
    }
  }
  return null;
}

/**
 * Map a raw bill object from the Congress.gov API to CongressBill.
 */
function mapBill(raw: Record<string, unknown>): CongressBill {
  const latestActionRaw = raw.latestAction as Record<string, unknown> | undefined;
  const sponsorRaw = raw.sponsors as Array<Record<string, unknown>> | undefined;
  const sponsor = sponsorRaw?.[0];

  // Committees may be nested in different shapes depending on endpoint
  const committeeRaw =
    (raw.committees as Record<string, unknown> | undefined) ||
    (raw.committee as Record<string, unknown> | undefined);
  const committeeItems =
    (committeeRaw?.item as Array<Record<string, unknown>>) ||
    (raw.committeeList as Array<Record<string, unknown>>) ||
    [];

  const billType = ((raw.type as string) || "").toLowerCase();
  const billNumber = String(raw.number || "");
  const billId = `${billType}${billNumber}`;

  return {
    billId,
    number: billNumber,
    title: (raw.title as string) || "",
    type: billType,
    congress: (raw.congress as number) || CURRENT_CONGRESS,
    introducedDate: (raw.introducedDate as string) || "",
    latestAction: (latestActionRaw?.text as string) || "",
    latestActionDate: (latestActionRaw?.actionDate as string) || "",
    sponsor: sponsor
      ? `${(sponsor.firstName as string) || ""} ${(sponsor.lastName as string) || ""}`.trim()
      : "",
    sponsorParty: (sponsor?.party as string) || "",
    cosponsorCount:
      typeof raw.cosponsors === "number"
        ? (raw.cosponsors as number)
        : (raw.cosponsorCount as number) || 0,
    committees: committeeItems.map(
      (c) => (c.name as string) || (c.systemCode as string) || "",
    ),
    status: (latestActionRaw?.text as string) || "",
    source: "congress.gov",
  };
}

/**
 * Search Congress.gov for bills matching a text query.
 *
 * @param opts.query   Full-text search string
 * @param opts.congress  Optional congress number (e.g. 119). Defaults to current.
 * @param opts.limit   Max results to return (default: CONGRESS_PER_PAGE_LIMIT)
 */
export async function searchBills(opts: {
  query: string;
  congress?: number;
  limit?: number;
}): Promise<CongressBill[]> {
  const params = baseParams();
  if (!params) {
    console.warn("[congress] CONGRESS_API_KEY is not set — skipping searchBills");
    return [];
  }

  params.query = opts.query;
  params.limit = String(opts.limit ?? CONGRESS_PER_PAGE_LIMIT);
  if (opts.congress) params.congress = String(opts.congress);

  const data = await getJson<{ bills: Record<string, unknown>[] }>(
    `${CONGRESS_API_BASE}/bill`,
    { params, timeout: CONGRESS_REQUEST_TIMEOUT },
  );

  if (!data?.bills) return [];

  return data.bills.map(mapBill);
}

/**
 * Fetch full details for a single bill, including its action history and
 * cosponsor list.
 *
 * @param billId  Human-readable bill ID such as "hr1234" or "s5678"
 */
export async function getBillDetails(
  billId: string,
): Promise<CongressBillDetail | null> {
  const params = baseParams();
  if (!params) {
    console.warn("[congress] CONGRESS_API_KEY is not set — skipping getBillDetails");
    return null;
  }

  const parsed = parseBillId(billId);
  if (!parsed) {
    console.warn(`[congress] Cannot parse billId: ${billId}`);
    return null;
  }

  const congress = CURRENT_CONGRESS;
  const baseUrl = `${CONGRESS_API_BASE}/bill/${congress}/${parsed.type}/${parsed.number}`;

  // Fetch bill, actions, and cosponsors in parallel
  const [billData, actionsData, cosponsorsData] = await Promise.all([
    getJson<{ bill: Record<string, unknown> }>(baseUrl, {
      params,
      timeout: CONGRESS_REQUEST_TIMEOUT,
    }),
    getJson<{ actions: { items: Array<Record<string, unknown>> } }>(
      `${baseUrl}/actions`,
      { params, timeout: CONGRESS_REQUEST_TIMEOUT },
    ),
    getJson<{ cosponsors: { items: Array<Record<string, unknown>> } }>(
      `${baseUrl}/cosponsors`,
      { params, timeout: CONGRESS_REQUEST_TIMEOUT },
    ),
  ]);

  if (!billData?.bill) return null;

  const base = mapBill(billData.bill);

  const actionItems: Array<{ date: string; text: string }> = (
    actionsData?.actions?.items || []
  ).map((a) => ({
    date: (a.actionDate as string) || "",
    text: (a.text as string) || "",
  }));

  const cosponsorItems: Array<{ name: string; party: string; state: string }> = (
    cosponsorsData?.cosponsors?.items || []
  ).map((c) => ({
    name:
      `${(c.firstName as string) || ""} ${(c.lastName as string) || ""}`.trim(),
    party: (c.party as string) || "",
    state: (c.state as string) || "",
  }));

  // Related bills embedded in the bill object
  const relatedRaw =
    (billData.bill.relatedBills as Record<string, unknown> | undefined) || {};
  const relatedItems = (relatedRaw.item as Array<Record<string, unknown>>) || [];
  const relatedBills = relatedItems.map((r) => {
    const rType = ((r.type as string) || "").toLowerCase();
    const rNum = String(r.number || "");
    return {
      billId: `${rType}${rNum}`,
      title: (r.title as string) || "",
    };
  });

  // CBO cost estimate URL if present
  const cbosRaw = billData.bill.cboCostEstimates as
    | Array<Record<string, unknown>>
    | undefined;
  const cboUrl = cbosRaw?.[0]?.url as string | undefined;

  return {
    ...base,
    actions: actionItems,
    cosponsors: cosponsorItems,
    relatedBills,
    cboUrl,
  };
}

/**
 * Map a Congress.gov bill type to the GovTrack URL slug.
 * GovTrack uses "hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres".
 */
function toGovTrackType(type: string): string {
  return type.toLowerCase();
}

/**
 * Fetch the GovTrack prognosis score for a bill.
 *
 * GovTrack embeds a passage probability near the word "prognosis" on each
 * bill page. This function scrapes that percentage and any accompanying
 * factor bullet points, returning them in a structured result.
 *
 * @param billId  Human-readable bill ID such as "hr1234" or "s5678"
 * @returns Prognosis object, or null if the page is not found / no data.
 */
export async function getPrognosis(billId: string): Promise<{
  billId: string;
  passage: number;
  factors: string[];
  lastUpdated: string;
  source: "govtrack";
} | null> {
  const parsed = parseBillId(billId);
  if (!parsed) {
    console.warn(`[congress] getPrognosis: cannot parse billId: ${billId}`);
    return null;
  }

  const govTrackType = toGovTrackType(parsed.type);
  const url = `https://www.govtrack.us/congress/bills/${CURRENT_CONGRESS}/${govTrackType}${parsed.number}`;

  const html = await getText(url, { timeout: 20_000 });
  if (!html) {
    return null;
  }

  // GovTrack renders prognosis as a percentage near the word "prognosis".
  // Common patterns seen in the wild:
  //   "3% chance of being enacted"
  //   "Prognosis: 12%"
  //   data-value="0.03"  (fractional, inside a prognosis widget)
  // We try multiple patterns in order of specificity.

  let passage: number | null = null;

  // Pattern 1: data-value attribute on a prognosis element (fractional 0–1)
  const dataValueMatch = html.match(
    /prognosis[^]*?data-value="(0(?:\.\d+)?|1(?:\.0*)?)"/i,
  );
  if (dataValueMatch) {
    const val = parseFloat(dataValueMatch[1]);
    if (!isNaN(val)) passage = Math.round(val * 100);
  }

  // Pattern 2: explicit "N% chance" phrasing near "prognosis"
  if (passage === null) {
    const chanceMatch = html.match(
      /prognosis[^]*?(\d{1,3})\s*%\s*chance/i,
    );
    if (chanceMatch) {
      const val = parseInt(chanceMatch[1], 10);
      if (!isNaN(val) && val >= 0 && val <= 100) passage = val;
    }
  }

  // Pattern 3: bare "Prognosis: N%" or "prognosis\s*…\s*N%"
  if (passage === null) {
    const bareMatch = html.match(/prognosis[^%\n]{0,80}?(\d{1,3})\s*%/i);
    if (bareMatch) {
      const val = parseInt(bareMatch[1], 10);
      if (!isNaN(val) && val >= 0 && val <= 100) passage = val;
    }
  }

  if (passage === null) {
    console.warn(
      `[congress] getPrognosis: page found for ${billId} but no prognosis percentage could be parsed`,
    );
    return null;
  }

  // Extract factor bullet points if present.
  // GovTrack typically lists factors in a <ul> or <ol> near the prognosis section.
  const factors: string[] = [];
  // Find the prognosis section, then grab list items within the next ~2000 chars.
  const prognosisIdx = html.search(/prognosis/i);
  if (prognosisIdx !== -1) {
    const snippet = html.slice(prognosisIdx, prognosisIdx + 2000);
    // Match <li>…</li> content, stripping inner tags
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(snippet)) !== null) {
      const text = liMatch[1]
        .replace(/<[^>]+>/g, " ") // strip HTML tags
        .replace(/\s+/g, " ")
        .trim();
      if (text) factors.push(text);
    }
  }

  // Best-effort last-updated: look for an ISO date near "last updated" or "updated"
  let lastUpdated = "";
  const dateMatch = html.match(
    /(?:last\s+updated|updated)[^<\n]{0,60}?(\d{4}-\d{2}-\d{2})/i,
  );
  if (dateMatch) {
    lastUpdated = dateMatch[1];
  } else {
    // Fall back to today's date as a placeholder
    lastUpdated = new Date().toISOString().slice(0, 10);
  }

  return {
    billId: billId.trim().toLowerCase(),
    passage,
    factors,
    lastUpdated,
    source: "govtrack",
  };
}

/**
 * Fetch upcoming floor schedule for the House, Senate, or both chambers.
 *
 * @param chamber  "house" | "senate" — omit to fetch both
 */
export async function getFloorSchedule(
  chamber?: "house" | "senate",
): Promise<FloorAction[]> {
  const params = baseParams();
  if (!params) {
    console.warn("[congress] CONGRESS_API_KEY is not set — skipping getFloorSchedule");
    return [];
  }

  const chambers: Array<"house" | "senate"> =
    chamber ? [chamber] : ["house", "senate"];

  const results: FloorAction[] = [];

  await Promise.all(
    chambers.map(async (ch) => {
      const endpoint = ch === "house" ? "house-floor-action" : "senate-floor-action";
      const data = await getJson<{
        floorActions: { items: Array<Record<string, unknown>> };
      }>(`${CONGRESS_API_BASE}/${endpoint}`, {
        params,
        timeout: CONGRESS_REQUEST_TIMEOUT,
      });

      const items = data?.floorActions?.items || [];
      for (const item of items) {
        results.push({
          chamber: ch === "house" ? "House" : "Senate",
          date: (item.actionTime as string) || (item.actionDate as string) || "",
          billNumber: (item.billNumber as string) || undefined,
          description: (item.actionDescription as string) || (item.item as string) || "",
          source: "congress.gov",
        });
      }
    }),
  );

  // Sort chronologically
  results.sort((a, b) => a.date.localeCompare(b.date));

  return results;
}
