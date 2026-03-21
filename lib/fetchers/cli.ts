#!/usr/bin/env node
/**
 * CLI entry point for fetcher tools.
 * Called by Claude agents via Bash during pipeline runs.
 *
 * Usage (from project root):
 *   npx tsx lib/fetchers/cli.ts <command> [options]
 *
 * Commands:
 *   cross-market    --query "<keywords>"
 *   whitehouse      --search "<topic>" [--type eos|briefings|statements|all] [--limit N]
 *   oira            --search "<topic>" [--source fedreg|unified|both] [--limit N]
 *   fec             --candidate "<name>" [--office P|S|H] [--state XX] [--cycle YYYY]
 *   fec             --committee "<name>" [--limit N]
 *   polling         --race "<description>" [--source wikipedia|rcp|both]
 *   congress        --search "<topic>" [--congress 119] [--limit N]
 *   congress        --bill "<billId>"
 *   congress        --floor [--chamber house|senate]
 *   fred            --series "<SERIES_ID or shorthand>" [--limit N]
 *   fred            --search "<topic>" [--limit N]
 *   fred            --releases --series "<SERIES_ID>"
 *   confirmations   --position "<title>" [--president "<name>"]
 *   confirmations   --appointments [--president "<name>"]
 *   pvi             --state "<XX>" [--district N]
 *   pvi             --competitive [--threshold N]
 *   senate          --members [--party R|D|I]
 *   senate          --votes [--congress 119] [--limit N]
 *   senate          --whip "<nomineeType>"
 */

import { searchCrossMarket } from "./crossMarket";
import { searchCandidates, searchCommittees } from "./fec";
import { fetchOira } from "./oira";
import { fetchPolling } from "./polling";
import { fetchWhiteHouse } from "./whitehouse";
import { searchBills, getBillDetails, getFloorSchedule } from "./congress";
import { getSeries, searchSeries, getReleaseDates } from "./fred";
import { searchConfirmations, getBaseRates, getAppointments } from "./confirmations";
import { getDistrictLean, getCompetitiveRaces } from "./pvi";
import { getMembers, getNominationVotes, getWhipEstimate } from "./senate";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command) {
    console.error("Usage: cli.ts <command> [options]");
    console.error("Commands: cross-market, whitehouse, oira, fec, polling, congress, fred, confirmations, pvi, senate");
    process.exit(1);
  }

  const args = parseArgs(rest);

  try {
    let result: unknown;

    switch (command) {
      case "cross-market": {
        const query = args.query;
        if (!query) throw new Error("--query is required");
        result = await searchCrossMarket(query);
        break;
      }

      case "whitehouse": {
        const search = args.search;
        if (!search) throw new Error("--search is required");
        result = await fetchWhiteHouse({
          query: search,
          type: (args.type as "eos" | "briefings" | "statements" | "all") || "all",
          limit: args.limit ? parseInt(args.limit) : 5,
        });
        break;
      }

      case "oira": {
        const search = args.search;
        if (!search) throw new Error("--search is required");
        result = await fetchOira({
          query: search,
          agency: args.agency,
          stage: args.stage,
          source: (args.source as "fedreg" | "unified" | "both") || "both",
          limit: args.limit ? parseInt(args.limit) : 10,
        });
        break;
      }

      case "fec": {
        if (args.candidate) {
          result = await searchCandidates({
            name: args.candidate,
            office: args.office,
            state: args.state,
            cycle: args.cycle ? parseInt(args.cycle) : undefined,
            limit: args.limit ? parseInt(args.limit) : undefined,
          });
        } else if (args.committee) {
          result = await searchCommittees({
            name: args.committee,
            limit: args.limit ? parseInt(args.limit) : undefined,
          });
        } else {
          throw new Error("--candidate or --committee is required");
        }
        break;
      }

      case "polling": {
        const race = args.race;
        if (!race) throw new Error("--race is required");
        result = await fetchPolling({
          race,
          source: (args.source as "wikipedia" | "rcp" | "both") || "both",
        });
        break;
      }

      case "congress": {
        if (args.bill) {
          result = await getBillDetails(args.bill);
        } else if (args.floor !== undefined) {
          result = await getFloorSchedule(args.chamber as "house" | "senate" | undefined);
        } else {
          const search = args.search;
          if (!search) throw new Error("--search, --bill, or --floor is required");
          result = await searchBills({
            query: search,
            congress: args.congress ? parseInt(args.congress) : undefined,
            limit: args.limit ? parseInt(args.limit) : undefined,
          });
        }
        break;
      }

      case "fred": {
        if (args.releases) {
          if (!args.series) throw new Error("--series is required with --releases");
          result = await getReleaseDates(args.series);
        } else if (args.search) {
          result = await searchSeries(args.search, args.limit ? parseInt(args.limit) : undefined);
        } else if (args.series) {
          result = await getSeries(args.series, args.limit ? parseInt(args.limit) : undefined);
        } else {
          throw new Error("--series, --search, or --releases is required");
        }
        break;
      }

      case "confirmations": {
        if (args.appointments !== undefined) {
          result = await getAppointments(args.president);
        } else {
          const position = args.position;
          if (!position) throw new Error("--position or --appointments is required");
          result = await searchConfirmations({ position, president: args.president });
          const baseRates = await getBaseRates(position);
          result = { records: result, baseRates };
        }
        break;
      }

      case "pvi": {
        if (args.competitive !== undefined) {
          result = await getCompetitiveRaces(args.threshold ? parseInt(args.threshold) : undefined);
        } else {
          const state = args.state;
          if (!state) throw new Error("--state or --competitive is required");
          result = await getDistrictLean(state, args.district ? parseInt(args.district) : undefined);
        }
        break;
      }

      case "senate": {
        if (args.whip) {
          result = await getWhipEstimate(args.whip);
        } else if (args.votes !== undefined) {
          result = await getNominationVotes(
            args.congress ? parseInt(args.congress) : undefined,
            args.limit ? parseInt(args.limit) : undefined,
          );
        } else if (args.members !== undefined) {
          result = await getMembers(args.party as "R" | "D" | "I" | undefined);
        } else {
          throw new Error("--members, --votes, or --whip is required");
        }
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: (err as Error).message }));
    process.exit(1);
  }
}

main();
