'use client';

// components/for-rep/hours-log.tsx — "Log your hours" on a rep's unlisted page.
// Reads and writes /api/rep/hours with the page's signed grant. The rate comes from the server
// (lib/rep/hours.ts), never from a prop a page could type wrong. Admin chrome is not involved;
// this renders on the dark marketing shell, so zinc tones match the page around it.
import * as React from 'react';
import { moneyFromCents, type HoursRow, type HoursSummary } from '@/lib/rep/hours';

type Feed = { code: string; rate_cents: number; rows: HoursRow[]; summary: HoursSummary };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const HOURS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];

export default function HoursLog({ token, repName }: { token: string; repName: string }) {
  const [feed, setFeed] = React.useState<Feed | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(todayLocal());
  const [hours, setHours] = React.useState(2);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/rep/hours?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) {
        setFailed(j?.error ?? 'failed');
        return;
      }
      setFeed(j);
    } catch {
      setFailed('failed');
    }
  }, [token]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/rep/hours', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, worked_on: date, hours, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error === 'day_full' ? 'That day already has three entries — edit by texting Sandon.' : j?.error === 'date_future' ? 'That date is in the future.' : j?.error === 'date_too_old' ? 'Only the last 60 days can be logged here.' : 'Could not save that — try again or text Sandon.');
        return;
      }
      setFeed(j);
      setNote('');
      setMsg('Saved.');
    } finally {
      setBusy(false);
    }
  }

  const rate = feed ? moneyFromCents(feed.rate_cents) : null;
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Log your hours</h2>
        {rate && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">{rate}/hr</span>}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        After a round of flyers, add the day, the hours and where you went. Sandon sees the same list and pays the open hours by Stripe or Venmo; paid rows get a date here, so you both read one record.
      </p>

      {failed ? (
        <p className="mt-4 text-sm text-rose-300">This log isn&apos;t reachable right now ({failed}). Text Sandon your hours and he&apos;ll add them.</p>
      ) : (
        <>
          <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-zinc-400">
              Day
              <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" required />
            </label>
            <label className="text-xs text-zinc-400">
              Hours
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs text-zinc-400">
              Where you went
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Town, the Thriftway strip, Burton…" maxLength={240} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600" />
            </label>
            <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
              <button type="submit" disabled={busy || !feed} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60">
                {busy ? 'Saving…' : 'Add hours'}
              </button>
              {msg && <span className={`text-sm ${msg === 'Saved.' ? 'text-emerald-300' : 'text-rose-300'}`}>{msg}</span>}
            </div>
          </form>

          {feed && (
            <div className="mt-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="text-xl font-bold text-white">{feed.summary.hoursTotal}</div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">hours logged</div>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="text-xl font-bold text-amber-200">{moneyFromCents(feed.summary.owedCents)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">open, to be paid</div>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="text-xl font-bold text-emerald-200">{moneyFromCents(feed.summary.paidCents)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">paid so far</div>
                </div>
              </div>
              {feed.rows.length > 0 ? (
                <ul className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                  {feed.rows.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-zinc-200">{r.worked_on}</span>
                        <span className="text-zinc-400"> · {r.hours} h</span>
                        {r.note && <div className="truncate text-xs text-zinc-500">{r.note}</div>}
                      </div>
                      <span className={`shrink-0 text-xs ${r.paid_at ? 'text-emerald-300' : 'text-amber-300'}`}>{r.paid_at ? `paid ${r.paid_via ?? ''}`.trim() : 'open'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">Nothing logged yet — your first round goes here.</p>
              )}
            </div>
          )}
        </>
      )}
      <p className="mt-4 text-xs text-zinc-500">{repName}, this log is only reachable from this page; the link is yours, don&apos;t forward it.</p>
    </div>
  );
}
