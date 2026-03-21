import { getJson, getText } from "../httpClient";
import {
  CONGRESS_API_BASE,
  CONGRESS_REQUEST_TIMEOUT,
} from "../config";
import type { Senator, NominationVote, WhipEstimate } from "../types";

function getCongressApiKey(): string | null {
  return process.env.CONGRESS_API_KEY || null;
}

// ---- senate.gov XML parsing -------------------------------------------------

const SENATE_VOTE_LIST_URL =
  "https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_119_1.xml";

function senateVoteDetailUrl(voteNumber: string): string {
  const padded = voteNumber.padStart(5, "0");
  return `https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_${padded}.xml`;
}

/** Extract text content of an XML tag (simple regex, no parser needed). */
function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

/** Extract all matches for a repeating XML tag. */
function xmlTagAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

// ---- Congress.gov member API ------------------------------------------------

interface RawCongressMember {
  bioguideId: string;
  name: string;
  partyName: string;
  state: string;
  terms?: { item?: Array<{ startYear?: number; endYear?: number }> };
}

function mapCongressMember(m: RawCongressMember): Senator {
  // Parse party initial from full party name
  const partyMap: Record<string, "R" | "D" | "I"> = {
    Republican: "R",
    Democratic: "D",
    Independent: "I",
  };
  const party = partyMap[m.partyName] || "I";

  // Estimate next election from terms
  let nextElection = 0;
  if (m.terms?.item?.length) {
    const latestTerm = m.terms.item[m.terms.item.length - 1];
    nextElection = latestTerm?.endYear || 0;
  }

  return {
    name: m.name || "",
    party,
    state: m.state || "",
    memberId: m.bioguideId || "",
    nextElection,
    source: "congress.gov",
  };
}

// ---- Exports ---------------------------------------------------------------

/**
 * Fetch current Senate members from Congress.gov API.
 * Optionally filter by party ("R", "D", or "I").
 */
export async function getMembers(
  party?: "R" | "D" | "I",
): Promise<Senator[]> {
  const key = getCongressApiKey();
  if (!key) {
    console.warn(
      "[senate] CONGRESS_API_KEY is not set — skipping getMembers",
    );
    return [];
  }

  const data = await getJson<{ members: RawCongressMember[] }>(
    `${CONGRESS_API_BASE}/member/congress/119`,
    {
      params: {
        api_key: key,
        currentMember: "true",
        limit: "250",
      },
      timeout: CONGRESS_REQUEST_TIMEOUT,
    },
  );

  const members = data?.members ?? [];
  // Congress.gov returns both House and Senate — filter to Senate
  // The endpoint /member/congress/119 includes all members, so we filter
  // by checking if they are senators (6-year terms, state without district)
  const senators = members.map(mapCongressMember);

  if (party) {
    return senators.filter((s) => s.party === party);
  }
  return senators;
}

/**
 * Fetch recent Senate nomination/confirmation votes from senate.gov XML.
 * No API key required — senate.gov publishes vote data as public XML.
 */
export async function getNominationVotes(
  congress?: number,
  limit?: number,
): Promise<NominationVote[]> {
  const maxResults = limit ?? 20;

  // Fetch the vote menu XML for the current session
  const session = 1; // First session of congress
  const cong = congress ?? 119;
  const listUrl = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${cong}_${session}.xml`;

  const xml = await getText(listUrl, { timeout: 15_000 });
  if (!xml) return [];

  // Parse vote entries from XML
  const voteBlocks = xmlTagAll(xml, "vote");
  const nominationVotes: NominationVote[] = [];

  for (const block of voteBlocks) {
    const title = xmlTag(block, "title") || xmlTag(block, "question");
    const issue = xmlTag(block, "issue");

    // Filter for nomination/confirmation votes
    const text = `${title} ${issue}`.toLowerCase();
    if (
      !text.includes("nomin") &&
      !text.includes("confirm") &&
      !text.includes("advise and consent")
    ) {
      continue;
    }

    const voteNumber = xmlTag(block, "vote_number");
    const yeas = parseInt(xmlTag(block, "yeas")) || 0;
    const nays = parseInt(xmlTag(block, "nays")) || 0;
    const date = xmlTag(block, "vote_date");
    const result = xmlTag(block, "result");

    nominationVotes.push({
      voteId: `${cong}-${session}-${voteNumber}`,
      description: title || issue,
      result: result || "",
      date: date || "",
      yesVotes: yeas,
      noVotes: nays,
      notVoting: 0, // Not in summary XML; available in detail XML
      source: "senate.gov",
    });

    if (nominationVotes.length >= maxResults) break;
  }

  return nominationVotes;
}

/**
 * Build a whip-count estimate for a given nominee type.
 *
 * Uses Congress.gov for senator roster and senate.gov for vote patterns.
 * Identifies swing senators from competitive states and cross-party voting history.
 */
export async function getWhipEstimate(
  nomineeType: string,
): Promise<WhipEstimate> {
  const [allSenators, recentVotes] = await Promise.all([
    getMembers(),
    getNominationVotes(),
  ]);

  // Party counts
  const republicans = allSenators.filter((s) => s.party === "R");
  const democrats = allSenators.filter((s) => s.party === "D");
  const independents = allSenators.filter((s) => s.party === "I");
  const minoritySenators = [...democrats, ...independents];

  // Detect crossover patterns from recent vote data
  const swingSenators: WhipEstimate["swingSenators"] = [];
  let defectorCount = 0;
  let crossoverCount = 0;

  for (const vote of recentVotes) {
    const totalYes = vote.yesVotes;
    const rCount = republicans.length;

    if (totalYes > 0 && rCount > 0) {
      if (totalYes > rCount) {
        crossoverCount += totalYes - rCount;
      }
      if (totalYes < rCount && rCount - totalYes <= 5) {
        defectorCount += rCount - totalYes;
      }
    }
  }

  const voteCount = recentVotes.length || 1;
  const avgDefectors = Math.round(defectorCount / voteCount);
  const avgCrossovers = Math.round(crossoverCount / voteCount);

  // Flag senators from competitive states as potential swing votes
  const swingStates = new Set([
    "ME", "AK", "AZ", "WV", "MT", "OH", "PA", "NV", "CO", "GA",
  ]);

  for (const senator of allSenators) {
    if (!swingStates.has(senator.state)) continue;

    if (senator.party === "R" && avgDefectors > 0) {
      swingSenators.push({
        name: senator.name,
        party: senator.party,
        state: senator.state,
        likelihood: avgDefectors >= 2 ? "uncertain" : "unlikely",
      });
    }

    if (senator.party !== "R" && avgCrossovers > 0) {
      swingSenators.push({
        name: senator.name,
        party: senator.party,
        state: senator.state,
        likelihood: avgCrossovers >= 2 ? "likely" : "uncertain",
      });
    }
  }

  // If no vote data, flag known moderate states as uncertain
  if (recentVotes.length === 0) {
    for (const senator of allSenators) {
      if (swingStates.has(senator.state)) {
        swingSenators.push({
          name: senator.name,
          party: senator.party,
          state: senator.state,
          likelihood: "uncertain",
        });
      }
    }
  }

  const estimatedYes = Math.max(0, republicans.length - avgDefectors);
  const estimatedNo = Math.max(0, minoritySenators.length - avgCrossovers);
  const estimatedUncertain =
    allSenators.length - estimatedYes - estimatedNo;

  return {
    nomineeType,
    estimatedYes,
    estimatedNo,
    estimatedUncertain: Math.max(0, estimatedUncertain),
    swingSenators,
    source: "congress.gov",
  };
}
