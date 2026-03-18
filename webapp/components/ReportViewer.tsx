"use client";

import { useMemo, useState } from "react";
import type { ParsedReport, RankingEntry } from "@/lib/reportParser";
import ReportSection from "./ReportSection";
import RichText from "./RichText";
import { parseBulletBlock } from "@/lib/richTextUtils";

interface Props {
  report: ParsedReport;
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors =
    level === "high"
      ? "bg-green-900/40 text-green-400"
      : level === "medium"
        ? "bg-blue-900/40 text-blue-400"
        : "bg-yellow-900/40 text-yellow-400";
  return (
    <span className={`px-2 py-0.5 rounded text-xs uppercase ${colors}`}>
      {level}
    </span>
  );
}

function EdgeDisplay({ edge, direction }: { edge: string; direction: string }) {
  // Extract just the percentage part (e.g. "+7%" from "+7% -> lean YES")
  const pctMatch = edge.match(/^([+-]?\~?\d+%?)/);
  const pct = pctMatch ? pctMatch[1] : edge.split("->")[0].trim();
  const label = edge.includes("lean YES") ? "lean YES" :
                edge.includes("lean NO") ? "lean NO" : "";
  const color = direction === "yes" ? "text-green-400" :
                direction === "no" ? "text-red-400" : "text-neutral-400";
  const bgColor = direction === "yes" ? "bg-green-500/10 border-green-500/20" :
                  direction === "no" ? "bg-red-500/10 border-red-500/20" :
                  "bg-neutral-800 border-neutral-700";

  return (
    <div className={`rounded-lg border px-3 py-2 ${bgColor}`}>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{pct}</div>
      {label && <div className={`text-xs ${color} opacity-75`}>{label}</div>}
      <div className="text-xs text-neutral-500">Edge</div>
    </div>
  );
}

/** Extract numeric edge value for sorting. Returns absolute value. */
function absEdge(edge: string): number {
  const m = edge.match(/[+-]?\s*~?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function RankingRow({ r, highlight }: { r: RankingEntry; highlight?: boolean }) {
  const edgeText = r.edge.split("(")[0].trim() || "~0%";
  const edgeColor = r.edge.startsWith("+") ? "text-green-400" :
                    r.edge.startsWith("-") ? "text-red-400" :
                    "text-neutral-500";
  return (
    <div className={`flex items-center gap-3 py-1.5 border-b border-neutral-800/50 last:border-0 ${
      highlight ? "bg-blue-500/5" : ""
    } ${r.grouped ? "opacity-70" : ""}`}>
      <span className="text-neutral-600 text-xs w-5 text-right font-mono">#{r.rank}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${highlight ? "text-neutral-100 font-medium" : "text-neutral-300"}`}>
          {r.outcome}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums flex-shrink-0">
        <div className="text-right w-12">
          <span className="text-neutral-400">{r.marketPrice}</span>
        </div>
        <div className="text-right w-12">
          <span className="text-neutral-200">{r.estimate}</span>
        </div>
        <span className={`font-mono min-w-[3rem] text-right font-medium ${edgeColor}`}>
          {edgeText}
        </span>
      </div>
    </div>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
          <RichText text={item} className="text-neutral-300" />
        </li>
      ))}
    </ul>
  );
}

/** Renders a block of text as structured rich bullets with markdown formatting */
function RichBulletSection({ text, icon }: { text: string; icon?: string }) {
  const items = parseBulletBlock(text);

  if (items.length === 0) {
    // Single paragraph, no bullets
    return (
      <p className="text-sm text-neutral-300 leading-relaxed">
        <RichText text={text} />
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        // Check if item has a bold label prefix like "**Name** (X%): description"
        const labelMatch = item.match(/^\*\*(.+?)\*\*\s*(.*)$/s);

        if (labelMatch) {
          return (
            <div key={i} className="flex items-start gap-2.5">
              {icon && <span className="text-sm mt-0.5 flex-shrink-0">{icon}</span>}
              <div>
                <div className="text-sm font-semibold text-neutral-200">
                  {labelMatch[1]}
                </div>
                <div className="text-sm text-neutral-400 leading-relaxed mt-0.5">
                  <RichText text={labelMatch[2]} />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={i} className="flex items-start gap-2.5">
            {icon && <span className="text-sm mt-0.5 flex-shrink-0">{icon}</span>}
            {!icon && <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-neutral-600" />}
            <p className="text-sm text-neutral-300 leading-relaxed">
              <RichText text={item} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Renders content that may contain markdown tables, bullet lists, or paragraphs */
function SmartBlock({ text }: { text: string }) {
  // Check if it contains a markdown table
  const lines = text.split("\n").filter((l) => l.trim());
  const tableLines = lines.filter((l) => l.includes("|"));

  if (tableLines.length >= 3) {
    // Parse markdown table
    const headerLine = tableLines[0];
    const dataLines = tableLines.slice(2); // skip separator
    const headers = headerLine
      .split("|")
      .map((h) => h.trim())
      .filter(Boolean);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-700">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-xs text-neutral-500 uppercase tracking-wide font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataLines.map((line, ri) => {
              const cells = line
                .split("|")
                .map((c) => c.trim())
                .filter(Boolean);
              return (
                <tr
                  key={ri}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
                >
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-neutral-300">
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback: render as rich text paragraphs
  return <RichBulletSection text={text} />;
}

function PreBlock({ text }: { text: string }) {
  return (
    <pre className="text-xs text-neutral-400 whitespace-pre-wrap font-mono leading-relaxed">
      {text}
    </pre>
  );
}

export default function ReportViewer({ report }: Props) {
  const isEvent = report.rankings.length > 0;
  const [showAllRankings, setShowAllRankings] = useState(false);

  // Sort by absolute edge to find the most actionable outcomes
  const TOP_COUNT = 5;
  const topByEdge = useMemo(() => {
    if (report.rankings.length <= TOP_COUNT) return null; // show all if few
    const sorted = [...report.rankings].sort((a, b) => absEdge(b.edge) - absEdge(a.edge));
    return new Set(sorted.slice(0, TOP_COUNT).map((r) => r.rank));
  }, [report.rankings]);

  return (
    <div className="space-y-3">
      {/* === Verdict Header === */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        {/* Meta line */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-neutral-500">
            {report.closeDate && `Closes: ${report.closeDate}`}
            {report.volume && ` \u00B7 Volume: ${report.volume}`}
          </div>
          {report.confidence && <ConfidenceBadge level={report.confidence} />}
        </div>

        {/* Binary verdict */}
        {!isEvent && report.estimatedProbability && (
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-3xl font-bold text-neutral-100 tabular-nums">
                  {report.estimatedProbability}
                </div>
                <div className="text-xs text-neutral-500">Estimated</div>
              </div>
              <div className="text-neutral-700 text-xl">/</div>
              <div>
                <div className="text-xl text-neutral-400 tabular-nums">
                  {report.marketPrice || "\u2014"}
                </div>
                <div className="text-xs text-neutral-500">Market</div>
              </div>
            </div>
            {report.edge && (
              <EdgeDisplay edge={report.edge} direction={report.edgeDirection} />
            )}
          </div>
        )}

        {/* Event rankings */}
        {isEvent && (
          <div>
            {/* Column headers */}
            <div className="flex items-center gap-3 pb-1.5 mb-1 border-b border-neutral-700 text-xs text-neutral-600">
              <span className="w-5" />
              <span className="flex-1">Outcome</span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="w-12 text-right">Market</span>
                <span className="w-12 text-right">Est</span>
                <span className="min-w-[3rem] text-right">Edge</span>
              </div>
            </div>

            {/* Top outcomes by edge (or all if <= TOP_COUNT) */}
            {topByEdge
              ? report.rankings
                  .filter((r) => topByEdge.has(r.rank))
                  .sort((a, b) => absEdge(b.edge) - absEdge(a.edge))
                  .map((r) => (
                    <RankingRow key={r.rank} r={r} highlight />
                  ))
              : report.rankings.map((r) => (
                  <RankingRow key={r.rank} r={r} />
                ))
            }

            {/* Expand to show all rankings in original order */}
            {topByEdge && (
              <>
                {showAllRankings && (
                  <div className="mt-2 pt-2 border-t border-neutral-800">
                    <div className="text-xs text-neutral-600 mb-1">All outcomes (by rank)</div>
                    {report.rankings.map((r) => (
                      <RankingRow
                        key={r.rank}
                        r={r}
                        highlight={topByEdge.has(r.rank)}
                      />
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowAllRankings(!showAllRankings)}
                  className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-2 mt-1 border-t border-neutral-800/50"
                >
                  {showAllRankings
                    ? "Show top edges only"
                    : `Show all ${report.rankings.length} outcomes`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Crux */}
        {report.crux && (
          <div className="mt-3 pt-3 border-t border-neutral-800">
            <div className="text-xs text-neutral-600 uppercase tracking-wide mb-1">Crux</div>
            <p className="text-sm text-neutral-300 leading-relaxed">
              <RichText text={report.crux} />
            </p>
          </div>
        )}
      </div>

      {/* === Bull / Bear === */}
      {(report.bullCase.length > 0 || report.bearCase.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.bullCase.length > 0 && (
            <div className="bg-green-950/20 border border-green-900/30 rounded-lg p-4">
              <div className="text-xs text-green-500 uppercase tracking-wide font-medium mb-2">
                Bull Case
              </div>
              <BulletList items={report.bullCase} color="bg-green-500" />
            </div>
          )}
          {report.bearCase.length > 0 && (
            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
              <div className="text-xs text-red-500 uppercase tracking-wide font-medium mb-2">
                Bear Case
              </div>
              <BulletList items={report.bearCase} color="bg-red-500" />
            </div>
          )}
        </div>
      )}

      {/* === Betting Recommendation === */}
      {report.bettingRecommendation && (
        <ReportSection title="Betting Recommendation" badge="$100" badgeColor="bg-emerald-900/50">
          <SmartBlock text={report.bettingRecommendation} />
        </ReportSection>
      )}

      {/* === Tail Risks === */}
      {report.tailRisks && (
        <ReportSection title="Tail Risks">
          <RichBulletSection text={report.tailRisks} icon={"\u26A0\uFE0F"} />
        </ReportSection>
      )}

      {/* === Resolution Watch === */}
      {report.resolutionWatch && (
        <ReportSection title="Resolution Watch">
          <RichBulletSection text={report.resolutionWatch} icon={"\uD83D\uDD0E"} />
        </ReportSection>
      )}

      {/* === Cross-Market === */}
      {report.crossMarket && (
        <ReportSection title="Cross-Market Comparison">
          <SmartBlock text={report.crossMarket} />
        </ReportSection>
      )}

      {/* === Key Sources === */}
      {report.keySources.length > 0 && (
        <ReportSection title="Key Sources" badge={`${report.keySources.length}`}>
          <ul className="space-y-2">
            {report.keySources.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-neutral-600 mt-0.5 text-xs flex-shrink-0">{"\uD83D\uDCCE"}</span>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 hover:decoration-blue-300/50"
                  >
                    {s.title || s.url} {"\u2197"}
                  </a>
                ) : (
                  <span className="text-sm text-neutral-400">{s.title}</span>
                )}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {/* === Methodology === */}
      {report.probabilityMethodology && (
        <ReportSection title="Probability Methodology" defaultOpen={false}>
          <RichBulletSection text={report.probabilityMethodology} />
        </ReportSection>
      )}

      {/* === Analyst Notes === */}
      {report.analystNotes && (
        <ReportSection title="Analyst Notes" defaultOpen={false}>
          <SmartBlock text={report.analystNotes} />
        </ReportSection>
      )}

      {/* === Dark Horse (events) === */}
      {report.darkHorse && (
        <ReportSection title="Dark Horse" defaultOpen={false}>
          <RichBulletSection text={report.darkHorse} />
        </ReportSection>
      )}

      {/* === Delta Analysis === */}
      {report.deltaAnalysis && (
        <ReportSection title="Delta Analysis" badge="vs prior" badgeColor="bg-purple-900/50">
          <SmartBlock text={report.deltaAnalysis} />
        </ReportSection>
      )}

      {/* === Raw Agent Outputs (collapsed) === */}
      {report.evidenceAgent && (
        <ReportSection title="Evidence Agent (raw)" defaultOpen={false}>
          <PreBlock text={report.evidenceAgent} />
        </ReportSection>
      )}
      {report.devilsAdvocate && (
        <ReportSection title="Devil's Advocate (raw)" defaultOpen={false}>
          <PreBlock text={report.devilsAdvocate} />
        </ReportSection>
      )}
      {report.resolutionAnalysis && (
        <ReportSection title="Resolution Analysis (raw)" defaultOpen={false}>
          <PreBlock text={report.resolutionAnalysis} />
        </ReportSection>
      )}
      {report.chaosAgent && (
        <ReportSection title="Chaos Agent (raw)" defaultOpen={false}>
          <PreBlock text={report.chaosAgent} />
        </ReportSection>
      )}
    </div>
  );
}
