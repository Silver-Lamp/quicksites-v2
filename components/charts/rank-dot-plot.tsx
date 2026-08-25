'use client';

// Page-one rankings as a dot plot: one row per query, x = Google position (1 best).
//
// ⚠️ FORM CHOSEN SO IT CANNOT OVERSELL. The honest story on this page is "good positions, tiny
// volume", and a bar chart of positions would say only the flattering half — worse, a bar implies
// longer = more, which inverts the meaning of a rank. A dot plot on a 1→10 axis reads as "how far
// from the top", and every dot carries its impression count so the smallness travels with the
// position instead of being a caveat somewhere below the chart.
//
// ⚠️ TWO SERIES, NOT EIGHT. city+trade vs generic is the analytical point of the page; anything
// finer would be colour for its own sake. Palette is slots 1–2 of the reference categorical theme
// (#3987e5 / #d95926), validated for the dark surface these pages actually use — worst adjacent
// CVD ΔE 26.8, normal-vision 31.8, contrast ≥3:1. Identity is never colour-alone: the legend is
// always present and each dot's tooltip names its group.
//
// ⚠️ DARK-ONLY BY DESIGN, and that is a deliberate divergence from the skill's "select both modes".
// The QuickSites app chrome is always dark (CLAUDE.md §7 — ThemeScope pins .dark on <html>), so a
// light variant here would be unreachable code pretending to be careful.

import * as React from 'react';

export type RankQuery = {
  query: string;
  position: number;
  impressions: number;
  clicks?: number;
  host: string;
  kind: 'city_trade' | 'generic' | string;
};

// ⚠️ THREE SLOTS, NOT TWO, BECAUSE A THIRD KIND EXISTS IN THE DATA. The first cut declared two
// series and let anything else fall through to the generic colour — which silently painted
// "b and l towing" (someone searching a DIFFERENT company, where we happen to rank) as a
// near-me query. A chart that quietly reassigns a category is asserting something false about it.
// Slots 1–3 of the reference theme, validated on this surface: worst adjacent CVD ΔE 9.4,
// normal-vision 26.5, contrast ≥3:1.
const SERIES = {
  city_trade: { color: '#3987e5', label: 'City + trade' },
  generic: { color: '#d95926', label: 'Generic “near me”' },
  other: { color: '#199e70', label: 'Someone else’s name' },
} as const;

const SERIES_ORDER = ['city_trade', 'generic', 'other'] as const;

const SURFACE = '#09090b';
const ROW = 26;
const PAD = { top: 8, right: 92, bottom: 26, left: 168 };
const MAX_POS = 10;

export default function RankDotPlot({ queries }: { queries: RankQuery[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const rows = React.useMemo(() => [...queries].sort((a, b) => a.position - b.position), [queries]);
  const width = 720;
  const plotW = width - PAD.left - PAD.right;
  const height = PAD.top + rows.length * ROW + PAD.bottom;
  const x = (pos: number) => PAD.left + ((pos - 1) / (MAX_POS - 1)) * plotW;

  // Label selectively — the three highest-volume rows carry a value; the rest are in the tooltip.
  const labelled = new Set(
    [...rows]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
      .map((r) => r.query)
  );

  return (
    <figure className="mt-4 mb-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <figcaption className="mb-1 text-sm font-semibold text-white">
        Where each page-one query actually sits
      </figcaption>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        Position 1 is the top of Google. The number beside a dot is how many times it was seen in 28
        days — which is the part that keeps this honest.
      </p>

      {/* Legend — always present for two series, so identity is never colour alone. */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {SERIES_ORDER.filter((k) => queries.some((q) => q.kind === k)).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: SERIES[k].color }}
            />
            {SERIES[k].label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Dot plot of ${rows.length} page-one Google queries by position`}
      >
        {/* Recessive gridlines — hairline, solid, one step off surface. */}
        {[1, 3, 5, 7, 10].map((p) => (
          <g key={p}>
            <line
              x1={x(p)}
              x2={x(p)}
              y1={PAD.top}
              y2={PAD.top + rows.length * ROW}
              stroke="#27272a"
              strokeWidth={1}
            />
            <text
              x={x(p)}
              y={height - 8}
              textAnchor="middle"
              className="fill-zinc-600"
              style={{ fontSize: 11 }}
            >
              {p}
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const cy = PAD.top + i * ROW + ROW / 2;
          // ⚠️ No silent fallback to another series' colour — an unknown kind gets neutral ink and
          // is visibly not one of the labelled groups.
          const c = SERIES[r.kind as keyof typeof SERIES]?.color ?? '#71717a';
          const on = hover === i;
          return (
            <g
              key={`${r.host}-${r.query}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'default' }}
            >
              {/* Hit target larger than the mark. */}
              <rect x={0} y={cy - ROW / 2} width={width} height={ROW} fill="transparent" />
              {on && <rect x={0} y={cy - ROW / 2} width={width} height={ROW} fill="#ffffff08" />}

              <text
                x={PAD.left - 10}
                y={cy + 4}
                textAnchor="end"
                className={on ? 'fill-zinc-100' : 'fill-zinc-400'}
                style={{ fontSize: 12 }}
              >
                {r.query.length > 26 ? `${r.query.slice(0, 25)}…` : r.query}
              </text>

              {/* Stem to the top of the scale, then the dot. */}
              <line
                x1={x(1)}
                x2={x(r.position)}
                y1={cy}
                y2={cy}
                stroke={c}
                strokeWidth={2}
                opacity={0.35}
              />
              {/* 2px surface ring keeps the dot legible where marks crowd. */}
              <circle cx={x(r.position)} cy={cy} r={5} fill={c} stroke={SURFACE} strokeWidth={2} />

              {(labelled.has(r.query) || on) && (
                <text
                  x={x(r.position) + 12}
                  y={cy + 4}
                  className="fill-zinc-500"
                  style={{ fontSize: 11 }}
                >
                  {r.impressions} impr
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
          <span className="font-semibold text-white">{rows[hover].query}</span>
          {' · '}position {rows[hover].position} · {rows[hover].impressions} impressions ·{' '}
          {rows[hover].clicks ?? 0} clicks
          <span className="text-zinc-500">
            {' '}
            · {rows[hover].host} ·{' '}
            {SERIES[rows[hover].kind as keyof typeof SERIES]?.label ?? 'other'}
          </span>
        </div>
      )}
    </figure>
  );
}
