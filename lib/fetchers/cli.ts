#!/usr/bin/env node
/**
 * CLI entry point for fetcher tools.
 * Called by Claude agents via Bash during pipeline runs.
 *
 * Usage (from project root):
 *   npx tsx lib/fetchers/cli.ts <command> [options]
 *
 * Commands:
 *   cross-market --query "<keywords>"
 *   whitehouse   --search "<topic>" [--type eos|briefings|statements|all] [--limit N]
 *   oira         --search "<topic>" [--source fedreg|unified|both] [--limit N]
 *   fec          --candidate "<name>" [--office P|S|H] [--state XX] [--cycle YYYY]
 *   fec          --committee "<name>" [--limit N]
 *   polling      --race "<description>" [--source wikipedia|rcp|both]
 */

import { searchCrossMarket } from "./crossMarket";
import { searchCandidates, searchCommittees } from "./fec";
import { fetchOira } from "./oira";
import { fetchPolling } from "./polling";
import { fetchWhiteHouse } from "./whitehouse";
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
    console.error("Commands: cross-market, whitehouse, oira, fec, polling");
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
