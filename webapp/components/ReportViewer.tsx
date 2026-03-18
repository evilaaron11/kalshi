"use client";

import type { ParsedReport } from "@/lib/reportParser";
import ReportSection from "./ReportSection";

interface Props {
  report: ParsedReport;
}

function EdgeBadge({ edge, direction }: { edge: string; direction: string }) {
  const colors =
    direction === "yes"
      ? "bg-green-900/50 text-green-400 border-green-700/50"
      : direction === "no"
        ? "bg-red-900/50 text-red-400 border-red-700/50"
        : "bg-neutral-800 text-neutral-400 border-neutral-700";
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-mono ${colors}`}>
      {edge}
    </span>
  );
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

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
          <span className="text-neutral-300">{item}</span>
        </li>
      ))}
    </ul>
  );
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

  return (
    <div className="space-y-3">
      {/* === Verdict Header === */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">
              {report.closeDate && `Closes: ${report.closeDate}`}
              {report.volume && ` \u00B7 Volume: ${report.volume}`}
            </div>

            {/* Binary verdict */}
            {!isEvent && report.estimatedProbability && (
              <div className="flex items-baseline gap-4 mt-2">
                <div>
                  <div className="text-3xl font-bold text-neutral-100 tabular-nums">
                    {report.estimatedProbability}
                  </div>
                  <div className="text-xs text-neutral-500">Estimated</div>
                </div>
                <div className="text-neutral-700 text-xl">/</div>
                <div>
                  <div className="text-xl text-neutral-400 tabular-nums">
                    {report.marketPrice || "—"}
                  </div>
                  <div className="text-xs text-neutral-500">Market</div>
                </div>
                {report.edge && (
                  <div className="ml-2">
                    <EdgeBadge edge={report.edge} direction={report.edgeDirection} />
                  </div>
                )}
              </div>
            )}

            {/* Event rankings */}
            {isEvent && (
              <div className="mt-2 space-y-2">
                {report.rankings.map((r) => (
                  <div key={r.rank} className="flex items-center gap-3">
                    <span className="text-neutral-600 text-sm w-6 text-right">#{r.rank}</span>
                    <div className="flex-1">
                      <div className="text-sm text-neutral-200 font-medium">{r.outcome}</div>
                      <div className="text-xs text-neutral-500">
                        Market: {r.marketPrice} \u00B7 Est: {r.estimate}
                        {r.edge && <> \u00B7 Edge: {r.edge}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confidence + Crux sidebar */}
          <div className="text-right space-y-2 flex-shrink-0">
            {report.confidence && <ConfidenceBadge level={report.confidence} />}
          </div>
        </div>

        {report.crux && (
          <div className="mt-3 pt-3 border-t border-neutral-800 text-sm text-neutral-400">
            <span className="text-neutral-600 text-xs uppercase tracking-wide">Crux: </span>
            {report.crux}
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
        <ReportSection title="Betting Recommendation" badge="$100">
          <PreBlock text={report.bettingRecommendation} />
        </ReportSection>
      )}

      {/* === Tail Risks === */}
      {report.tailRisks && (
        <ReportSection title="Tail Risks">
          <PreBlock text={report.tailRisks} />
        </ReportSection>
      )}

      {/* === Resolution Watch === */}
      {report.resolutionWatch && (
        <ReportSection title="Resolution Watch">
          <PreBlock text={report.resolutionWatch} />
        </ReportSection>
      )}

      {/* === Cross-Market === */}
      {report.crossMarket && (
        <ReportSection title="Cross-Market Comparison">
          <PreBlock text={report.crossMarket} />
        </ReportSection>
      )}

      {/* === Key Sources === */}
      {report.keySources.length > 0 && (
        <ReportSection title="Key Sources" badge={`${report.keySources.length}`}>
          <ul className="space-y-1">
            {report.keySources.map((s, i) => (
              <li key={i} className="text-xs">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {s.title || s.url} &#8599;
                  </a>
                ) : (
                  <span className="text-neutral-400">{s.title}</span>
                )}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {/* === Methodology === */}
      {report.probabilityMethodology && (
        <ReportSection title="Probability Methodology" defaultOpen={false}>
          <PreBlock text={report.probabilityMethodology} />
        </ReportSection>
      )}

      {/* === Analyst Notes === */}
      {report.analystNotes && (
        <ReportSection title="Analyst Notes" defaultOpen={false}>
          <p className="text-sm text-neutral-400">{report.analystNotes}</p>
        </ReportSection>
      )}

      {/* === Dark Horse (events) === */}
      {report.darkHorse && (
        <ReportSection title="Dark Horse" defaultOpen={false}>
          <PreBlock text={report.darkHorse} />
        </ReportSection>
      )}

      {/* === Delta Analysis === */}
      {report.deltaAnalysis && (
        <ReportSection title="Delta Analysis" badge="vs prior" badgeColor="bg-purple-900/50">
          <PreBlock text={report.deltaAnalysis} />
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
