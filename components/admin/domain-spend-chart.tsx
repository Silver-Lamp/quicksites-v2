'use client';

// components/admin/domain-spend-chart.tsx
//
// Forward-looking cumulative-spend chart for owned domains. Two scenario lines over the
// projection window (see lib/domains/ownedInventory.ts#projectDomainSpend):
//   • "Unrented liability" (amber) — cumulative renewal spend if you keep them and never rent.
//   • "After current rentals" (emerald) — net of the rent you already collect; dips below
//     zero once rentals more than cover renewals.
// Two status-semantic hues, each carried by a legend + a direct end-label so identity is
// never color-alone; one y-axis, thin 2px lines, recessive grid, a hover crosshair. Pure
// inline SVG — no chart lib, theme-aware via currentColor + fixed hues.

import { useMemo, useRef, useState } from 'react';
import type { SpendProjectionPoint } from '@/lib/domains/ownedInventory';

const AMBER = '#f59e0b'; // liability (warning)
const EMERALD = '#34d399'; // net after rent (good)

const W = 760;
const H = 260;
const PAD = { t: 18, r: 118, b: 28, l: 52 };

const fmt = (cents: number) => {
  const d = Math.round((Number(cents) || 0) / 100);
  const abs = Math.abs(d);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : `$${abs}`;
  return d < 0 ? `−${s}` : s;
};

export default function DomainSpendChart({ points }: { points: SpendProjectionPoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    const n = points.length;
    const plotL = PAD.l;
    const plotR = W - PAD.r;
    const plotT = PAD.t;
    const plotB = H - PAD.b;

    const maxV = Math.max(1, ...points.map((p) => p.grossCents));
    const minV = Math.min(0, ...points.map((p) => p.netCents));
    const span = maxV - minV || 1;

    const x = (i: number) => (n <= 1 ? plotL : plotL + (i / (n - 1)) * (plotR - plotL));
    const y = (v: number) => plotB - ((v - minV) / span) * (plotB - plotT);

    const line = (key: 'grossCents' | 'netCents') =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

    const grossArea =
      `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
      points.map((p, i) => `L${x(i).toFixed(1)},${y(p.grossCents).toFixed(1)}`).join(' ') +
      ` L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

    // ~4 horizontal gridlines across the value domain.
    const ticks: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) ticks.push(minV + (span * i) / steps);

    return { n, plotL, plotR, plotT, plotB, x, y, minV, grossPath: line('grossCents'), netPath: line('netCents'), grossArea, ticks, zeroY: y(0), hasNegative: minV < 0 };
  }, [points]);

  if (!points.length) return null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - geo.plotL) / (geo.plotR - geo.plotL);
    const i = Math.round(frac * (geo.n - 1));
    setHover(i >= 0 && i < geo.n ? i : null);
  };

  const hp = hover != null ? points[hover] : null;

  return (
    <div className="w-full">
      {/* Legend — identity is never color-alone. */}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5 text-neutral-300">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: AMBER }} /> Unrented liability
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-300">
          <span className="inline-block h-2 w-3 rounded-sm" style={{ background: EMERALD }} /> After current rentals
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-neutral-600"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* horizontal grid + y labels */}
        {geo.ticks.map((v, i) => {
          const yy = geo.y(v);
          return (
            <g key={i}>
              <line x1={geo.plotL} x2={geo.plotR} y1={yy} y2={yy} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />
              <text x={geo.plotL - 8} y={yy + 3} textAnchor="end" className="fill-neutral-500" fontSize={10}>{fmt(v)}</text>
            </g>
          );
        })}

        {/* zero baseline (emphasized when net goes negative) */}
        {geo.hasNegative && (
          <line x1={geo.plotL} x2={geo.plotR} y1={geo.zeroY} y2={geo.zeroY} stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />
        )}

        {/* x labels (month numbers) */}
        {points.map((p, i) =>
          i % Math.ceil(geo.n / 12) === 0 || i === geo.n - 1 ? (
            <text key={i} x={geo.x(i)} y={H - 10} textAnchor="middle" className="fill-neutral-500" fontSize={10}>
              {p.month}mo
            </text>
          ) : null,
        )}

        {/* gross liability faint fill + lines */}
        <path d={geo.grossArea} fill={AMBER} fillOpacity={0.1} />
        <path d={geo.grossPath} fill="none" stroke={AMBER} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={geo.netPath} fill="none" stroke={EMERALD} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* direct end-labels */}
        <text x={geo.plotR + 8} y={geo.y(points[geo.n - 1].grossCents) + 3} fontSize={11} fontWeight={600} fill={AMBER}>
          {fmt(points[geo.n - 1].grossCents)}/yr
        </text>
        <text x={geo.plotR + 8} y={geo.y(points[geo.n - 1].netCents) + 3} fontSize={11} fontWeight={600} fill={EMERALD}>
          net {fmt(points[geo.n - 1].netCents)}
        </text>

        {/* hover crosshair + markers */}
        {hp && (
          <g>
            <line x1={geo.x(hover!)} x2={geo.x(hover!)} y1={geo.plotT} y2={geo.plotB} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={geo.x(hover!)} cy={geo.y(hp.grossCents)} r={3.5} fill={AMBER} stroke="#0a0a0a" strokeWidth={1.5} />
            <circle cx={geo.x(hover!)} cy={geo.y(hp.netCents)} r={3.5} fill={EMERALD} stroke="#0a0a0a" strokeWidth={1.5} />
          </g>
        )}
      </svg>

      {hp && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-neutral-400">
          <span className="text-neutral-300">Month {hp.month}</span>
          <span><span style={{ color: AMBER }}>●</span> Liability {fmt(hp.grossCents)}</span>
          <span><span style={{ color: EMERALD }}>●</span> After rentals {fmt(hp.netCents)}</span>
        </div>
      )}
    </div>
  );
}
