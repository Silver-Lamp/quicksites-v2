// components/admin/templates/render-blocks/events.tsx
//
// Events / schedule — recurring times + upcoming dated events. HONESTY (same posture as
// announcement_bar): a DATED event auto-hides once its day has passed, so the list is never
// stale filler; recurring items (no date) always show. Emits schema.org Event JSON-LD for
// dated events. Server component — no client state needed.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type EventItem = { name?: string; date?: string; when?: string; location?: string; description?: string; cta_text?: string; cta_link?: string };
type Props = { block?: Block; content?: Block['content'] };

const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

// Parse a YYYY-MM-DD (or ISO) date to a day-resolution timestamp; null if unparseable.
function toDay(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}
function fmtDate(day: number): string {
  return new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function RenderEvents({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Upcoming events';
  const raw: EventItem[] = Array.isArray(c.events) ? c.events : [];

  // "Today" at day resolution (UTC) — a dated event hides only after its day fully passes.
  const todayDay = (() => {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  })();

  type Row = { it: EventItem; day: number | null };
  const rows: Row[] = raw
    .filter((it) => s(it.name))
    .map((it) => ({ it, day: toDay(s(it.date)) }))
    .filter((r) => r.day == null || r.day >= todayDay); // drop past dated events

  // Recurring (no date) first, then dated events soonest-first.
  rows.sort((a, b) => {
    if (a.day == null && b.day == null) return 0;
    if (a.day == null) return -1;
    if (b.day == null) return 1;
    return a.day - b.day;
  });

  if (rows.length === 0) return null;

  const jsonLd = rows
    .filter((r) => r.day != null)
    .map((r) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: s(r.it.name),
      startDate: s(r.it.date),
      ...(s(r.it.location) ? { location: { '@type': 'Place', name: s(r.it.location) } } : {}),
      ...(s(r.it.description) ? { description: s(r.it.description) } : {}),
    }));

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      {jsonLd.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
      <ul className="space-y-3">
        {rows.map(({ it, day }, i) => {
          const when = day != null ? fmtDate(day) : '';
          const timeLine = [when, s(it.when)].filter(Boolean).join(' · ');
          return (
            <li key={i} className="flex gap-4 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-muted px-2 py-2 text-center">
                {day != null ? (
                  <>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">{new Date(day).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>
                    <span className="text-xl font-bold leading-none tabular-nums">{new Date(day).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })}</span>
                  </>
                ) : (
                  <span className="text-xl" aria-hidden>🔁</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s(it.name)}</div>
                {timeLine && <div className="text-xs font-medium text-foreground/80">{timeLine}</div>}
                {s(it.location) && <div className="text-xs text-muted-foreground">{s(it.location)}</div>}
                {s(it.description) && <p className="mt-1 text-sm text-muted-foreground">{s(it.description)}</p>}
                {s(it.cta_text) && s(it.cta_link) && (
                  <a href={s(it.cta_link)} className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">{s(it.cta_text)} →</a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
