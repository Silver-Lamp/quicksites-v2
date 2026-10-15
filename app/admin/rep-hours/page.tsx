'use client';

// /admin/rep-hours — hourly pay as a per-rep option (lib/rep/hours.ts): every rep code with its
// config (on/off, rate, who pays), and for the hourly ones their logged rows with one button to
// mark a selection paid after the money has moved (Stripe or Venmo).
import * as React from 'react';
import { HOURLY_PAID_BY, PAID_BY_LABEL, moneyFromCents, type HoursRow, type HoursSummary, type HourlyPaidBy, type RepConfigRow } from '@/lib/rep/hours';

type CodeFeed = { code: string; label: string | null; rate_cents: number; paid_by: string | null; rows: Array<HoursRow & { code: string; paid_note?: string | null }>; summary: HoursSummary };

const inputCls = 'rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground';

function RepConfigEditor({ rep, onSaved }: { rep: RepConfigRow; onSaved: () => void }) {
  const [enabled, setEnabled] = React.useState(rep.enabled);
  const [rate, setRate] = React.useState(rep.rateCents != null ? String(rep.rateCents / 100) : '');
  const [paidBy, setPaidBy] = React.useState<HourlyPaidBy | ''>(rep.paidBy ?? '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const dirty = enabled !== rep.enabled || (rate === '' ? null : Math.round(Number(rate) * 100)) !== rep.rateCents || (paidBy || null) !== rep.paidBy;
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/rep-hours', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: rep.code, hourly_enabled: enabled, hourly_rate_cents: rate === '' ? null : Math.round(Number(rate) * 100), hourly_paid_by: paidBy || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j?.error === 'enabled_needs_rate_and_payer' ? 'Turning hourly on needs a rate and who pays.' : j?.error ?? 'failed');
      else onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-sm text-card-foreground">{rep.code}</td>
      <td className="px-3 py-2 text-sm text-muted-foreground">{rep.label || rep.ownerEmail || '—'}{rep.parentCode ? <span className="ml-1 text-xs">(rep of {rep.parentCode})</span> : null}</td>
      <td className="px-3 py-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-amber-500" /></td>
      <td className="px-3 py-2"><span className="text-sm text-muted-foreground">$</span><input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="—" className={`${inputCls} ml-1 w-20`} inputMode="decimal" /><span className="ml-1 text-xs text-muted-foreground">/hr</span></td>
      <td className="px-3 py-2">
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value as HourlyPaidBy | '')} className={inputCls}>
          <option value="">—</option>
          {HOURLY_PAID_BY.map((p) => (
            <option key={p} value={p}>{PAID_BY_LABEL[p]}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button type="button" disabled={!dirty || busy} onClick={save} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-40">
          Save
        </button>
        {err && <div className="mt-1 text-xs text-rose-400">{err}</div>}
      </td>
    </tr>
  );
}

export default function RepHoursAdminPage() {
  const [reps, setReps] = React.useState<RepConfigRow[] | null>(null);
  const [codes, setCodes] = React.useState<CodeFeed[]>([]);
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
    setReps(j.reps ?? []);
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Rep hours</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hourly pay is an option per rep. Turn it on with a rate and who pays; the rep then gets a hours log on their page. Pay open rows outside (Stripe or Venmo), tick them and mark paid so their page shows it.
      </p>
      {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

      <h2 className="mt-8 text-lg font-semibold text-foreground">Reps</h2>
      {reps === null ? (
        <p className="mt-3 text-sm text-muted-foreground">…</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Hourly</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Who pays</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => (
                <RepConfigEditor key={`${r.code}:${r.enabled}:${r.rateCents}:${r.paidBy}`} rep={r} onSaved={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold text-foreground">Logged hours</h2>
      {codes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No rep is on hourly pay yet.</p>
      ) : (
        codes.map((c) => (
          <section key={c.code} className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">
                {c.label || c.code} <span className="text-sm font-normal text-muted-foreground">· {c.code} · {moneyFromCents(c.rate_cents)}/hr · paid by {c.paid_by ? PAID_BY_LABEL[c.paid_by as HourlyPaidBy] : '—'}</span>
              </h3>
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
      {codes.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <select value={via} onChange={(e) => setVia(e.target.value as any)} className={inputCls}>
            <option value="venmo">Venmo</option>
            <option value="stripe">Stripe</option>
            <option value="other">Other</option>
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" maxLength={200} className={`${inputCls} min-w-0 flex-1`} />
          <button type="button" disabled={busy || !sel.size} onClick={() => act(false)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">
            Mark {sel.size || ''} paid
          </button>
          <button type="button" disabled={busy || !sel.size} onClick={() => act(true)} className="text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-50">
            Undo mark
          </button>
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        Next: post hourly positions (the same shape as an Internships listing) and share them on LinkedIn or Craigslist; a posting would create a code with hourly on, so a hire lands here already configured.
      </p>
    </div>
  );
}
