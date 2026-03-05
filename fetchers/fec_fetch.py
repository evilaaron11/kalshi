"""fec_fetch.py — FEC campaign finance data

Uses the FEC public API. No API key required (1000 req/hour with DEMO_KEY).
Set FEC_API_KEY in .env for higher rate limits (register free at api.open.fec.gov).

Usage (callable by agents via Bash):
    python -m fetchers.fec_fetch --candidate "Jon Ossoff"
    python -m fetchers.fec_fetch --candidate "Georgia" --office S --state GA --cycle 2026
    python -m fetchers.fec_fetch --candidate "Trump" --office P --cycle 2024
    python -m fetchers.fec_fetch --committee "Save America" --limit 5

Key signal: cash_on_hand is often a stronger predictor than polling,
especially in primaries. burn_rate > 1.0 means spending more than raising.

Output: JSON array of { name, party, office, state, district, cycle,
                        cash_on_hand, total_raised, total_spent,
                        burn_rate, coverage_date, candidate_id }
"""

import sys
import json
import os
import argparse
from dotenv import load_dotenv

from src.config import FEC_API_BASE, FEC_DEFAULT_API_KEY, FEC_REQUEST_TIMEOUT, FEC_PER_PAGE_LIMIT
from src import http_client

load_dotenv()

HEADERS = {"User-Agent": "kalshi-analyst/1.0"}


def api_key() -> str:
    return os.getenv("FEC_API_KEY", FEC_DEFAULT_API_KEY)


def search_candidates(name: str, office: str, state: str, cycle: int, limit: int) -> list[dict]:
    params = {
        "api_key":  api_key(),
        "q":        name,
        "sort":     "-receipts",
        "per_page": min(limit, FEC_PER_PAGE_LIMIT),
    }
    if office: params["office"] = office.upper()
    if state:  params["state"]  = state.upper()
    if cycle:  params["cycle"]  = cycle

    resp = http_client.get(f"{FEC_API_BASE}/candidates/totals/",
                           params=params, headers=HEADERS, timeout=FEC_REQUEST_TIMEOUT)
    return resp.json().get("results", []) if resp else []


def search_committees(name: str, limit: int) -> list[dict]:
    params = {
        "api_key":  api_key(),
        "q":        name,
        "sort":     "-last_cash_on_hand_end_period",
        "per_page": min(limit, FEC_PER_PAGE_LIMIT),
    }
    resp = http_client.get(f"{FEC_API_BASE}/committees/",
                           params=params, headers=HEADERS, timeout=FEC_REQUEST_TIMEOUT)
    return resp.json().get("results", []) if resp else []


def format_candidate(c: dict) -> dict:
    receipts      = c.get("receipts", 0) or 0
    disbursements = c.get("disbursements", 0) or 0
    cash          = c.get("cash_on_hand_end_period", 0) or 0
    burn_rate     = round(disbursements / receipts, 3) if receipts > 0 else None

    return {
        "name":          c.get("name", ""),
        "party":         c.get("party_full", c.get("party", "")),
        "office":        c.get("office_full", ""),
        "state":         c.get("state", ""),
        "district":      c.get("district", ""),
        "cycle":         c.get("cycle"),
        "cash_on_hand":  cash,
        "total_raised":  receipts,
        "total_spent":   disbursements,
        "burn_rate":     burn_rate,
        "coverage_date": c.get("coverage_end_date", ""),
        "candidate_id":  c.get("candidate_id", ""),
        "source":        "fec",
    }


def format_committee(c: dict) -> dict:
    return {
        "name":          c.get("name", ""),
        "type":          c.get("committee_type_full", c.get("committee_type", "")),
        "party":         c.get("party_full", c.get("party", "")),
        "state":         c.get("state", ""),
        "cycle":         c.get("cycle"),
        "cash_on_hand":  c.get("last_cash_on_hand_end_period", 0),
        "total_raised":  c.get("receipts", 0),
        "total_spent":   c.get("disbursements", 0),
        "coverage_date": c.get("last_report_year", ""),
        "committee_id":  c.get("committee_id", ""),
        "source":        "fec",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FEC campaign finance data")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--candidate",  help="Search by candidate name")
    group.add_argument("--committee",  help="Search by committee/PAC name")
    parser.add_argument("--office",    help="P=President, S=Senate, H=House", default="")
    parser.add_argument("--state",     help="2-letter state code (e.g. GA)", default="")
    parser.add_argument("--cycle",     type=int, default=None,
                        help="Election cycle year (e.g. 2026)")
    parser.add_argument("--limit",     type=int, default=10)
    args = parser.parse_args()

    if args.candidate:
        raw     = search_candidates(args.candidate, args.office, args.state, args.cycle, args.limit)
        results = [format_candidate(c) for c in raw]
    else:
        raw     = search_committees(args.committee, args.limit)
        results = [format_committee(c) for c in raw]

    sys.stdout.buffer.write((json.dumps(results, indent=2) + "\n").encode("utf-8"))
