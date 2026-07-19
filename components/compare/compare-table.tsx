// components/compare/compare-table.tsx
//
// Shared feature matrix for the compare cluster: FEATURE_ROWS down the side, QuickSites vs
// ONE competitor across. Pure server component — data comes from lib/compare/competitors.
// Used by each /compare/<slug> page (and reusable in the hub).

import { FEATURE_ROWS, competitorMark, type Competitor, type Mark } from '@/lib/compare/competitors';

const MARK_ICON: Record<Mark, string> = { yes: '✓', partial: '~', no: '✕' };
const MARK_TONE: Record<Mark, string> = {
  yes: 'text-emerald-400',
  partial: 'text-amber-400',
  no: 'text-zinc-600',
};

function Cell({ mark, note, highlight }: { mark: Mark; note: string; highlight?: boolean }) {
  return (
    <td className={`px-4 py-3 align-top ${highlight ? 'bg-emerald-500/[0.04]' : ''}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 font-bold ${MARK_TONE[mark]}`} aria-hidden>
          {MARK_ICON[mark]}
        </span>
        <span className="text-sm text-zinc-300">{note}</span>
      </div>
    </td>
  );
}

export function CompareTable({ competitor }: { competitor: Competitor }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Feature</th>
            <th className="px-4 py-3 text-sm font-bold text-emerald-300">QuickSites</th>
            <th className="px-4 py-3 text-sm font-bold text-zinc-200">{competitor.name}</th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_ROWS.map((row) => {
            const cm = competitorMark(competitor, row.key);
            return (
              <tr key={row.key} className="border-b border-zinc-800/70 last:border-0">
                <th scope="row" className="px-4 py-3 align-top">
                  <div className="text-sm font-medium text-zinc-100">{row.feature}</div>
                  {row.detail && <div className="mt-0.5 text-xs text-zinc-500">{row.detail}</div>}
                </th>
                <Cell mark={row.qs.mark} note={row.qs.note} highlight />
                <Cell mark={cm.mark} note={cm.note} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
