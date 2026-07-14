'use client';

// components/admin/ops/ops-widgets.tsx
//
// Reusable dashboard primitives for /admin/ops: KPI stat tile, a radial gauge (dial),
// a segmented mix bar, and a severity tag. Pure presentational — no data access.
// Theme-aware; identity is never carried by color alone (every mark ships a label).
// Follows the dataviz method: form-first (stat tiles for magnitudes, a single-value
// arc for a ratio), reserved status hues, thin recessive marks.

import type { ReactNode } from 'react';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-red-300',
  info: 'text-sky-300',
  neutral: 'text-neutral-200',
};
const TONE_STROKE: Record<Tone, string> = {
  good: '#34d399',
  warn: '#f59e0b',
  bad: '#f87171',
  info: '#38bdf8',
  neutral: '#a1a1aa',
};

export function formatMoney(cents: number, opts: { sign?: boolean } = {}): string {
  const neg = cents < 0;
  const s = `$${Math.abs(Math.round(cents / 100)).toLocaleString()}`;
  if (neg) return `−${s}`;
  return opts.sign ? `+${s}` : s;
}

/** A KPI stat tile — a headline number with a label and optional sub-line. */
export function KpiTile({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
        {icon ? <div className="shrink-0 text-neutral-500">{icon}</div> : null}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${TONE_TEXT[tone]}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-neutral-500">{sub}</div> : null}
    </>
  );
  const cls = 'block rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition';
  return href ? (
    <a href={href} className={`${cls} hover:border-zinc-600`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * A radial gauge (270° arc). `value`/`max` set the fill; the caption + big number
 * carry the meaning so the tone hue is reinforcement, never the sole signal.
 */
export function Gauge({
  value,
  max,
  label,
  center,
  tone = 'info',
  caption,
}: {
  value: number;
  max: number;
  label: string;
  /** Text shown in the middle; defaults to a percentage of max. */
  center?: string;
  tone?: Tone;
  caption?: ReactNode;
}) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = 48;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270°
  const track = `${(sweep * c).toFixed(2)} ${c.toFixed(2)}`;
  const fill = `${(frac * sweep * c).toFixed(2)} ${c.toFixed(2)}`;
  const mid = center ?? `${Math.round(frac * 100)}%`;

  return (
    <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <svg viewBox="0 0 120 120" className="h-28 w-28" role="img" aria-label={`${label}: ${mid}`}>
        <g transform="rotate(135 60 60)">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" className="text-zinc-800" strokeWidth={10} strokeDasharray={track} strokeLinecap="round" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={TONE_STROKE[tone]} strokeWidth={10} strokeDasharray={fill} strokeLinecap="round" />
        </g>
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" className={`fill-current ${TONE_TEXT[tone]}`} style={{ fontSize: 20, fontWeight: 600 }}>
          {mid}
        </text>
      </svg>
      <div className="mt-1 text-center text-xs font-medium text-neutral-300">{label}</div>
      {caption ? <div className="mt-0.5 text-center text-[11px] text-neutral-500">{caption}</div> : null}
    </div>
  );
}

export type Segment = { label: string; value: number; tone: Tone };

/** A single horizontal mix bar (fixed-order segments) with a labeled legend. */
export function SegmentBar({ segments, title }: { segments: Segment[]; title?: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      {title ? <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{title}</div> : null}
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) =>
          s.value > 0 ? (
            <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, backgroundColor: TONE_STROKE[s.tone] }} title={`${s.label}: ${s.value}`} />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TONE_STROKE[s.tone] }} />
            {s.label} <span className="font-medium text-neutral-200">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const SEV_TAG: Record<string, { cls: string; label: string }> = {
  critical: { cls: 'border-red-500/40 bg-red-500/10 text-red-300', label: 'Critical' },
  high: { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300', label: 'High' },
  medium: { cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300', label: 'Medium' },
  low: { cls: 'border-neutral-700 bg-neutral-800/60 text-neutral-400', label: 'Low' },
};

export function SeverityTag({ severity }: { severity: string }) {
  const s = SEV_TAG[severity] ?? SEV_TAG.low;
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
}
