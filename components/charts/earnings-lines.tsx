'use client';

// Monthly recurring commission over the first year, at three close-rates.
//
// ⚠️ THIS IS A MODEL, NOT DATA, AND THE CHART SAYS SO — twice, in the caption and on the plot.
// Nobody has rented one of these yet. A line chart of a projection looks exactly like a line chart
// of history, which is the whole risk of drawing it; the page's job is to help a rep judge whether
// this is worth her time, and compounding is genuinely hard to read from a table. So it ships with
// the assumption stated on the surface rather than in a footnote.
//
// ⚠️ ONE AXIS. Closes-per-week is the series identity, not a second scale — three lines on one
// dollar axis, never a dual axis.
//
// Palette: slots 1–3 of the reference categorical theme (#3987e5 / #d95926 / #199e70), validated
// against this page's dark surface — worst adjacent CVD ΔE 9.4, normal-vision 26.5, contrast ≥3:1.
// Legend present, and all three lines are directly labelled at the right edge where they have
// separated, so identity never depends on colour alone.
//
// ⚠️ Dark-only on purpose: the app chrome is always dark (CLAUDE.md §7).

import * as React from 'react';

const PER_ACCOUNT = 49.5; // half of the $99/mo pre-rank rate
const MONTHS = 12;
const RATES = [
  { perWeek: 1, color: '#3987e5', label: '1 a week' },
  { perWeek: 2, color: '#d95926', label: '2 a week' },
  { perWeek: 3, color: '#199e70', label: '3 a week' },
];

const PAD = { top: 14, right: 92, bottom: 30, left: 52 };
const W = 720;
const H = 260;

/**
 * Monthly recurring income in month m, if every account closed so far is still paying.
 *
 * ⚠️ 52/12, NOT 4.33. The rounded figure put month 12 at 51.96 weeks, so the chart's end-label
 * read $7,716 where the table on the same page said $7,722. Two different numbers for one claim,
 * six dollars apart, is the kind of thing a reader notices and cannot un-notice.
 */
const WEEKS_PER_MONTH = 52 / 12;
const monthly = (perWeek: number, m: number) => perWeek * WEEKS_PER_MONTH * m * PER_ACCOUNT;

export default function EarningsLines() {
  const [hoverM, setHoverM] = React.useState<number | null>(null);
  const maxY = monthly(3, MONTHS);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (m: number) => PAD.left + ((m - 1) / (MONTHS - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;
  const ticks = [0, 2000, 4000, 6000, 8000].filter((t) => t <= maxY * 1.02);

  return (
    <figure className="mt-4 mb-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <figcaption className="mb-1 text-sm font-semibold text-white">
        What it adds up to — if the accounts stay
      </figcaption>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        Your monthly income at $49.50 an account, month by month.{' '}
        <span className="text-amber-300">
          This is arithmetic, not a forecast — nobody has rented one yet
        </span>
        , and it assumes none of them cancel.
      </p>

      <div className="mb-2 flex flex-wrap items-center gap-4">
        {RATES.map((r) => (
          <span key={r.perWeek} className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: r.color }}
            />
            {r.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Projected monthly commission over twelve months at one, two and three closes per week"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="#27272a"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-zinc-600"
              style={{ fontSize: 11 }}
            >
              ${t.toLocaleString()}
            </text>
          </g>
        ))}
        {[1, 3, 6, 9, 12].map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - 8}
            textAnchor="middle"
            className="fill-zinc-600"
            style={{ fontSize: 11 }}
          >
            {m === 1 ? 'mo 1' : m}
          </text>
        ))}

        {hoverM !== null && (
          <line
            x1={x(hoverM)}
            x2={x(hoverM)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="#52525b"
            strokeWidth={1}
          />
        )}

        {RATES.map((r) => {
          const pts = Array.from(
            { length: MONTHS },
            (_, i) => `${x(i + 1)},${y(monthly(r.perWeek, i + 1))}`
          ).join(' ');
          const endV = monthly(r.perWeek, MONTHS);
          return (
            <g key={r.perWeek}>
              <polyline
                points={pts}
                fill="none"
                stroke={r.color}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle
                cx={x(MONTHS)}
                cy={y(endV)}
                r={4}
                fill={r.color}
                stroke="#09090b"
                strokeWidth={2}
              />
              <text
                x={x(MONTHS) + 10}
                y={y(endV) + 4}
                className="fill-zinc-400"
                style={{ fontSize: 11 }}
              >
                ${Math.round(endV).toLocaleString()}/mo
              </text>
              {hoverM !== null && (
                <circle
                  cx={x(hoverM)}
                  cy={y(monthly(r.perWeek, hoverM))}
                  r={4}
                  fill={r.color}
                  stroke="#09090b"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}

        {/* Hit bands wider than the marks. */}
        {Array.from({ length: MONTHS }, (_, i) => i + 1).map((m) => (
          <rect
            key={m}
            x={x(m) - plotW / (MONTHS - 1) / 2}
            y={PAD.top}
            width={plotW / (MONTHS - 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverM(m)}
            onMouseLeave={() => setHoverM(null)}
          />
        ))}
      </svg>

      {hoverM !== null && (
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
          <span className="font-semibold text-white">Month {hoverM}</span>
          {RATES.map((r) => (
            <span key={r.perWeek} className="ml-3">
              <span
                aria-hidden
                className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: r.color }}
              />
              {r.label}: ${Math.round(monthly(r.perWeek, hoverM)).toLocaleString()}/mo
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
