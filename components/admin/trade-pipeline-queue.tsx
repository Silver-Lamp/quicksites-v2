'use client';

// components/admin/trade-pipeline-queue.tsx
//
// The nightly pipeline's queue, on /admin/growth. A person adds city × trade rows (one city, or a
// whole metro); the cron sweeps them at its cap and builds drafts for every no-website business it
// finds. The panel says plainly whether the cron is ON — a queue that fills and never drains is the
// silent failure this feature would otherwise have.
import { useEffect, useState } from 'react';

type Row = {
  id: string;
  city: string;
  region: string;
  category: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  result: { found?: number; inserted?: number; tallies?: { no_website?: number } } | null;
  error: string | null;
};

type QueueState = { enabled: boolean; caps: { maxSweeps: number; maxBuilds: number }; rows: Row[]; metros: string[]; categories: string[] };

export default function TradePipelineQueue() {
  const [state, setState] = useState<QueueState | null>(null);
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [metro, setMetro] = useState('');
  const [category, setCategory] = useState('Towing');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/admin/prospects/sweep-queue', { cache: 'no-store' });
    if (r.ok) setState(await r.json());
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      const body = metro ? { metro, category } : { city, region, category };
      const r = await fetch('/api/admin/prospects/sweep-queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error || 'Could not queue.');
        return;
      }
      setMsg(`Queued ${j.inserted}${j.rejected?.length ? `, rejected ${j.rejected.length}` : ''}.${j.enabled ? '' : ' ⚠️ The cron is OFF (TRADE_PIPELINE_ENABLED) — nothing will drain this.'}`);
      setCity('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/cron/trade-site-pipeline', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      setMsg(j?.skipped ? `Skipped: ${j.detail}` : `Ran: ${j.sweeps ?? 0} sweep(s), ${j.noWebsiteFound ?? 0} no-website found, ${j.built ?? 0} built${j.buildsFailed ? `, ${j.buildsFailed} failed` : ''}.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await fetch(`/api/admin/prospects/sweep-queue?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  }

  const queued = state?.rows.filter((r) => r.status === 'queued').length ?? 0;
  const recent = state?.rows.slice(0, 8) ?? [];

  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-left">
          <div className="text-sm font-semibold">
            🌙 Nightly trade-site pipeline{' '}
            {state && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${state.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {state.enabled ? `ON · ${state.caps.maxSweeps} sweep + ${state.caps.maxBuilds} builds a night` : 'OFF — set TRADE_PIPELINE_ENABLED=1'}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {queued} queued. Queue a city × trade; the cron sweeps it and builds a draft for every no-website business. {open ? '▲' : '▼'}
          </div>
        </button>
        <button type="button" onClick={runNow} disabled={busy} className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
          Run now
        </button>
      </div>

      {open && state && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col text-xs text-muted-foreground">
              City
              <input value={city} onChange={(e) => { setCity(e.target.value); setMetro(''); }} placeholder="Arab" className="rounded-lg border border-border bg-background px-2 py-1 text-foreground" />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              State
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="AL" className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-foreground" />
            </label>
            <span className="pb-1 text-xs text-muted-foreground">or</span>
            <label className="flex flex-col text-xs text-muted-foreground">
              Metro (fans out ~30 cities)
              <select value={metro} onChange={(e) => { setMetro(e.target.value); setCity(''); }} className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
                <option value="">—</option>
                {state.metros.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              Trade
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
                {state.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button type="button" onClick={add} disabled={busy || (!metro && (!city || !region))} className="rounded-lg bg-emerald-400 px-3 py-1 font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">
              Queue
            </button>
          </div>
          {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
          {recent.length > 0 && (
            <ul className="divide-y divide-border text-xs">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1">
                  <span>
                    <span className="font-medium">{r.city}, {r.region}</span> · {r.category} ·{' '}
                    <span className={r.status === 'failed' ? 'text-rose-400' : r.status === 'done' ? 'text-emerald-300' : 'text-muted-foreground'}>{r.status}</span>
                    {r.result && <span className="text-muted-foreground"> · {r.result.tallies?.no_website ?? 0} no-website of {r.result.found ?? 0}</span>}
                    {r.error && <span className="text-rose-400"> · {r.error}</span>}
                  </span>
                  {r.status === 'queued' && (
                    <button type="button" onClick={() => cancel(r.id)} className="text-muted-foreground hover:text-foreground">cancel</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
