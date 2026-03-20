import { getJson, getText } from "../httpClient";
import {
  FEDERAL_REGISTER_API,
  FEDERAL_REGISTER_TIMEOUT,
  OIRA_XML_URL,
  OIRA_REQUEST_TIMEOUT,
} from "../config";
import { matchesQuery } from "../textUtils";

interface RegDoc {
  title: string;
  agency: string;
  stage: string;
  action?: string;
  published?: string;
  abstract: string;
  url: string;
  rin?: string;
  source: string;
}

const STAGE_MAP: Record<string, string> = {
  proposed: "PROPOSED_RULE",
  final: "RULE",
  notice: "NOTICE",
  presidential: "PRESIDENTIAL_DOCUMENT",
};

export async function fetchFedReg(opts: {
  query: string;
  agency?: string;
  stage?: string;
  limit?: number;
}): Promise<RegDoc[]> {
  const params: Record<string, string> = {
    "conditions[term]": opts.query,
    per_page: String(opts.limit || 10),
    order: "newest",
  };
  if (opts.stage && STAGE_MAP[opts.stage]) {
    params["conditions[type][]"] = STAGE_MAP[opts.stage];
  }
  if (opts.agency) {
    params["conditions[agency_ids][]"] = opts.agency;
  }

  const data = await getJson<{ results: Record<string, unknown>[] }>(
    FEDERAL_REGISTER_API,
    { params, timeout: FEDERAL_REGISTER_TIMEOUT },
  );
  if (!data?.results) return [];

  return data.results.map((d) => ({
    title: (d.title as string) || "",
    agency: ((d.agencies as { name: string }[])?.[0]?.name as string) || "",
    stage: (d.type as string) || "",
    action: (d.action as string) || "",
    published: (d.publication_date as string) || "",
    abstract: (d.abstract as string) || "",
    url: (d.html_url as string) || "",
    source: "federal_register",
  }));
}

export async function fetchUnifiedAgenda(opts: {
  query: string;
  agency?: string;
  stage?: string;
  limit?: number;
}): Promise<RegDoc[]> {
  const xml = await getText(OIRA_XML_URL, { timeout: OIRA_REQUEST_TIMEOUT });
  if (!xml) return [];

  // Simple XML parsing — extract RIN_INFO blocks
  const results: RegDoc[] = [];
  const blocks = xml.split(/<RIN_INFO>/i).slice(1);

  for (const block of blocks) {
    const extract = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "is"));
      return m ? m[1].trim() : "";
    };

    const title = extract("RULE_TITLE");
    const agency = extract("AGENCY");
    const stage = extract("STAGE");
    const rin = extract("RIN");
    const abstract = extract("ABSTRACT");

    const text = `${title} ${agency} ${abstract}`;
    if (!matchesQuery(text, opts.query)) continue;
    if (opts.agency && !agency.toLowerCase().includes(opts.agency.toLowerCase()))
      continue;
    if (opts.stage && !stage.toLowerCase().includes(opts.stage.toLowerCase()))
      continue;

    results.push({
      title,
      agency,
      stage,
      rin,
      abstract,
      url: rin
        ? `https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=${encodeURIComponent("202504")}&RIN=${rin}`
        : "",
      source: "oira_unified_agenda",
    });

    if (results.length >= (opts.limit || 10)) break;
  }

  return results;
}

export async function fetchOira(opts: {
  query: string;
  agency?: string;
  stage?: string;
  source?: "fedreg" | "unified" | "both";
  limit?: number;
}): Promise<RegDoc[]> {
  const src = opts.source || "both";
  const promises: Promise<RegDoc[]>[] = [];
  if (src === "fedreg" || src === "both") promises.push(fetchFedReg(opts));
  if (src === "unified" || src === "both") promises.push(fetchUnifiedAgenda(opts));
  const arrays = await Promise.all(promises);
  return arrays.flat().slice(0, opts.limit || 10);
}
