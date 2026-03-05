"""oira_agenda.py — Query the federal regulatory pipeline

Two data sources:
  1. Federal Register API (federalregister.gov) — published/recent rules
  2. OIRA Unified Agenda (reginfo.gov)          — forward-looking pipeline

Usage (callable by agents via Bash):
    python oira_agenda.py --search "tariffs"
    python oira_agenda.py --search "DOGE federal workforce" --agency "OPM"
    python oira_agenda.py --search "immigration" --stage final
    python oira_agenda.py --search "energy" --source unified   # pipeline only
    python oira_agenda.py --search "EPA climate" --source fedreg --limit 10

Output: JSON array of { title, agency, stage, abstract, url, source }

Stages (Federal Register): PROPOSED_RULE, RULE, NOTICE, PRESIDENTIAL_DOCUMENT
Stages (Unified Agenda):   Pre-Rule Stage, Proposed Rule Stage, Final Rule Stage, Completed Actions
"""

import sys
import json
import argparse
import requests
from xml.etree import ElementTree as ET

FEDREG_API   = "https://www.federalregister.gov/api/v1/documents.json"
# Unified Agenda XML — published semi-annually (Spring=04, Fall=10).
# Update UNIFIED_PUB_ID when a new edition is released.
UNIFIED_PUB_ID = "202504"
UNIFIED_URL    = f"https://www.reginfo.gov/public/do/XMLViewFileAction?f=REGINFO_RIN_DATA_{UNIFIED_PUB_ID}.xml"

HEADERS = {"User-Agent": "kalshi-analyst/1.0 (research tool)"}


def fetch_fedreg(query: str, agency: str, stage: str, limit: int) -> list[dict]:
    """Query the Federal Register API for matching documents."""
    # Map friendly stage names to FR document types
    stage_map = {
        "proposed": "PROPOSED_RULE",
        "final":    "RULE",
        "notice":   "NOTICE",
        "eo":       "PRESIDENTIAL_DOCUMENT",
    }

    # Use list of tuples — required for repeated array params (fields[], conditions[type][])
    fields = ["title", "agencies", "type", "publication_date", "abstract", "html_url", "action"]
    params = [
        ("conditions[term]", query),
        ("per_page", min(limit, 20)),
        ("order", "newest"),
    ] + [("fields[]", f) for f in fields]

    if stage and stage in stage_map:
        params.append(("conditions[type][]", stage_map[stage]))
    if agency:
        params.append(("conditions[agency_ids][]", agency))

    try:
        resp = requests.get(FEDREG_API, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"Federal Register API error: {e}", file=sys.stderr)
        return []

    results = []
    for doc in data.get("results", []):
        agency_names = [a.get("name", "") for a in doc.get("agencies", [])]
        results.append({
            "title":     doc.get("title", ""),
            "agency":    ", ".join(agency_names),
            "stage":     doc.get("type", ""),
            "action":    doc.get("action", ""),
            "published": doc.get("publication_date", ""),
            "abstract":  (doc.get("abstract") or "")[:1500],
            "url":       doc.get("html_url", ""),
            "source":    "federal_register",
        })
    return results


def _strip_html(text: str) -> str:
    """Strip HTML tags from a string (abstracts in the unified agenda contain inline HTML)."""
    try:
        from html.parser import HTMLParser

        class _Stripper(HTMLParser):
            def __init__(self):
                super().__init__()
                self.parts = []
            def handle_data(self, data):
                self.parts.append(data)

        s = _Stripper()
        s.feed(text)
        return " ".join(s.parts).strip()
    except Exception:
        return text


def fetch_unified_agenda(query: str, agency: str, stage: str, limit: int) -> list[dict]:
    """Fetch OIRA Unified Agenda (forward-looking pipeline) via reginfo.gov XML."""
    try:
        resp = requests.get(UNIFIED_URL, headers=HEADERS, timeout=60)
        resp.raise_for_status()
    except Exception as e:
        print(f"OIRA Unified Agenda fetch error: {e}", file=sys.stderr)
        return []

    try:
        root = ET.fromstring(resp.content)
    except Exception as e:
        print(f"OIRA XML parse error: {e}", file=sys.stderr)
        return []

    # Map user-friendly stage names to substrings of RULE_STAGE values in the XML
    stage_map = {
        "pre_rule":  "prerule",
        "proposed":  "proposed rule",
        "final":     "final rule",
        "completed": "completed",
    }
    stage_filter = stage_map.get(stage, stage).lower() if stage else ""

    query_lower = query.lower()
    results = []

    for rin_info in root.iter("RIN_INFO"):
        rin_el      = rin_info.find("RIN")
        title_el    = rin_info.find("RULE_TITLE")
        stage_el    = rin_info.find("RULE_STAGE")
        abstract_el = rin_info.find("ABSTRACT")
        agency_el   = rin_info.find("AGENCY/NAME")
        parent_el   = rin_info.find("PARENT_AGENCY/NAME")

        rin_text      = (rin_el.text      or "").strip() if rin_el      is not None else ""
        title_text    = (title_el.text    or "").strip() if title_el    is not None else ""
        stage_text    = (stage_el.text    or "").strip() if stage_el    is not None else ""
        abstract_raw  = (abstract_el.text or "").strip() if abstract_el is not None else ""
        abstract_text = _strip_html(abstract_raw)
        agency_name   = (agency_el.text   or "").strip() if agency_el   is not None else ""
        parent_name   = (parent_el.text   or "").strip() if parent_el   is not None else ""
        agency_text   = f"{parent_name} / {agency_name}" if parent_name and parent_name != agency_name else agency_name

        combined = (title_text + " " + abstract_text).lower()
        if query_lower and query_lower not in combined:
            words = [w for w in query_lower.split() if len(w) > 3]
            if words and sum(1 for w in words if w in combined) < 2:
                continue

        if agency and agency.lower() not in agency_text.lower():
            continue

        if stage_filter and stage_filter not in stage_text.lower():
            continue

        results.append({
            "title":    title_text,
            "agency":   agency_text,
            "stage":    stage_text,
            "rin":      rin_text,
            "abstract": abstract_text[:1500],
            "url":      f"https://www.reginfo.gov/public/do/eAgendaViewRule?pubId={UNIFIED_PUB_ID}&RIN={rin_text}" if rin_text else "",
            "source":   "oira_unified_agenda",
        })

        if len(results) >= limit:
            break

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Query the federal regulatory pipeline (Federal Register + OIRA Unified Agenda)"
    )
    parser.add_argument("--search",  default="",
                        help="Search query")
    parser.add_argument("--agency",  default="",
                        help="Filter by agency name (e.g. 'EPA', 'OPM', 'DHS')")
    parser.add_argument("--stage",   default="",
                        choices=["", "proposed", "final", "notice", "eo", "pre_rule", "completed"],
                        help="Filter by rule stage")
    parser.add_argument("--source",  default="both",
                        choices=["both", "fedreg", "unified"],
                        help="Data source: Federal Register, OIRA Unified Agenda, or both")
    parser.add_argument("--limit",   type=int, default=10,
                        help="Max results per source (default: 10)")
    args = parser.parse_args()

    results = []

    if args.source in ("both", "fedreg"):
        results.extend(fetch_fedreg(args.search, args.agency, args.stage, args.limit))

    if args.source in ("both", "unified"):
        results.extend(fetch_unified_agenda(args.search, args.agency, args.stage, args.limit))

    sys.stdout.buffer.write((json.dumps(results, indent=2) + "\n").encode("utf-8"))
