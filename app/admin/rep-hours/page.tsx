'use client';

// /admin/rep-hours — the owner's side of a rep's hours log (lib/rep/hours.ts): every hourly rep,
// their open rows, one button to mark a selection paid after the money has moved (Stripe or Venmo).
import * as React from 'react';
import { moneyFromCents, type HoursRow, type HoursSummary } from '@/lib/rep/hours';

type CodeFeed = { code: string; rate_cents: number; rows: Array<HoursRow & { code: string; paid_note?: string | null }>; summary: HoursSummary };

export default function RepHoursAdminPage() {
  const [codes, setCodes] = React.useState<CodeFeed[] | null>(null);
  const [sel, setSel] = React.useState<Set<string>>(() => new Set());
  const [via, setVia] = React.useState<'stripe' | 'venmo' | 'other'>('venmo');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const r = await fetch('/api/admin/rep-hours', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j?.error ?? 'failed');
      return;
    }
    setCodes(j.codes ?? []);
    setSel(new Set());
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  async function act(unpay: boolean) {
    if (!sel.size) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/rep-hours', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [...sel], paid_via: via, note, unpay }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j?.error ?? 'failed');
      else await load();
    } finally {
      setBusy(false);
    }
  }
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Rep hours</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What each hourly rep logged from their page. Pay the open rows outside (Stripe or Venmo), then tick them and mark paid so their page shows it.
      </p>
      {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
      {codes === null ? (
        <p className="mt-6 text-sm text-muted-foreground">…</p>
      ) : codes.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No hourly reps configured (lib/rep/hours.ts).</p>
      ) : (
        codes.map((c) => (
          <section key={c.code} className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {c.code} <span className="text-sm font-normal text-muted-foreground">· {moneyFromCents(c.rate_cents)}/hr</span>
              </h2>
              <div className="text-sm text-muted-foreground">
                {c.summary.hoursTotal} h logged · <span className="text-amber-400">{moneyFromCents(c.summary.owedCents)} open</span> · <span className="text-emerald-400">{moneyFromCents(c.summary.paidCents)} paid</span>
              </div>
            </div>
            {c.rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                {c.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground">
                    <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-amber-500" />
                    <span className="w-24 shrink-0 font-mono">{r.worked_on}</span>
                    <span className="w-12 shrink-0">{r.hours} h</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.note ?? ''}</span>
                    <span className={`shrink-0 text-xs ${r.paid_at ? 'text-emerald-400' : 'text-amber-400'}`}>{r.paid_at ? `paid ${r.paid_via ?? ''} ${r.paid_at.slice(0, 10)}` : 'open'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <select value={via} onChange={(e) => setVia(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <option value="venmo">Venmo</option>
          <option value="stripe">Stripe</option>
          <option value="other">Other</option>
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" maxLength={200} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
        <button type="button" disabled={busy || !sel.size} onClick={() => act(false)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">
          Mark {sel.size || ''} paid
        </button>
        <button type="button" disabled={busy || !sel.size} onClick={() => act(true)} className="text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-50">
          Undo mark
        </button>
      </div>
    </div>
  );
}
