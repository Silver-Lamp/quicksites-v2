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

  // ── Plan the queue from what we own and what we have measured ──
  type Planned = { city: string; region: string; industry: string; category: string; priority: number; reasons: string[] };
  const [plan, setPlan] = useState<{ plan: Planned[]; skipped: Array<{ city: string; region: string; industry: string; why: string }> } | null>(null);
  async function planQueue(apply: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/prospects/sweep-queue/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 14, apply }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error || 'Could not plan.');
        return;
      }
      setPlan({ plan: j.plan, skipped: j.skipped });
      if (apply) {
        setMsg(`Queued ${j.inserted} in ranked order — the cron takes the top one tonight.${j.enabled ? '' : ' ⚠️ The cron is OFF.'}`);
        setPlan(null);
        await load();
      }
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

  // ── Claim postcards (step 3) ──
  type MailState = { mailable: number; blocked: Record<string, number>; lobConfigured: boolean; mailEnabled: boolean; senderReady: boolean; cron: { enabled: boolean; maxMail: number; minAgeHours: number } };
  const [mail, setMail] = useState<MailState | null>(null);
  const [mailMsg, setMailMsg] = useState<string | null>(null);
  async function loadMail() {
    const r = await fetch('/api/admin/prospects/mail-claim-postcards', { cache: 'no-store' });
    if (r.ok) setMail(await r.json());
  }
  useEffect(() => {
    void loadMail();
  }, []);
  async function previewCards() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/prospects/mail-claim-postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preview: true }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.cards?.length) {
        setMailMsg(j?.error || 'Nothing to preview.');
        return;
      }
      const w = window.open('', '_blank');
      if (!w) return;
      const c = j.cards[0];
      w.document.write(`<title>Claim card — ${c.businessName}</title><div style="display:flex;gap:24px;padding:16px;background:#e5e7eb"><iframe style="width:6.2in;height:9.2in;border:0" srcdoc="${c.frontHtml.replace(/"/g, '&quot;')}"></iframe><iframe style="width:6.2in;height:9.2in;border:0" srcdoc="${c.backHtml.replace(/"/g, '&quot;')}"></iframe></div>`);
      w.document.close();
      setMailMsg(`Previewing 1 of ${j.mailable} mailable${j.blocked?.length ? ` · ${j.blocked.length} blocked (${[...new Set(j.blocked.map((b: any) => b.reason))].join(', ')})` : ''}.`);
    } finally {
      setBusy(false);
    }
  }
  async function mailCards(test: boolean) {
    if (!test && !window.confirm(`Mail claim postcards to up to ${mail?.cron.maxMail ?? 10} businesses now? This spends postage.`)) return;
    setBusy(true);
    setMailMsg(null);
    try {
      const r = await fetch('/api/admin/prospects/mail-claim-postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ test, limit: mail?.cron.maxMail ?? 10 }) });
      const j = await r.json().catch(() => ({}));
      setMailMsg(!r.ok ? `Refused: ${j?.error || r.status}` : `${test ? 'Test card' : 'Mailed'}: ${j.mailed} sent, ${j.blocked} blocked, ${j.failed} failed.`);
      await loadMail();
    } finally {
      setBusy(false);
    }
  }

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
            <span className="pb-1 text-xs text-muted-foreground">or</span>
            <button type="button" onClick={() => planQueue(false)} disabled={busy} className="rounded-lg border border-border px-3 py-1 hover:bg-muted disabled:opacity-50" title="Rank city × trade pairs from the domains we own and the no-website rates we have measured">
              Plan the queue
            </button>
          </div>
          {msg && <div className="text-xs text-muted-foreground">{msg}</div>}

          {plan && (
            <div className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Proposed order — {plan.plan.length} sweep{plan.plan.length === 1 ? '' : 's'}, one a night</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => setPlan(null)} className="rounded-lg border border-border px-2 py-1 hover:bg-muted">Discard</button>
                  <button type="button" onClick={() => planQueue(true)} disabled={busy || !plan.plan.length} className="rounded-lg bg-emerald-400 px-2 py-1 font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">Queue these {plan.plan.length}</button>
                </span>
              </div>
              <ol className="mt-2 space-y-1">
                {plan.plan.map((p, i) => (
                  <li key={`${p.city}-${p.region}-${p.category}`} className="flex gap-2">
                    <span className="w-5 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
                    <span><span className="font-medium">{p.city}, {p.region}</span> · {p.category} <span className="text-muted-foreground">— {p.reasons.join('; ')}</span></span>
                  </li>
                ))}
              </ol>
              {plan.skipped.length > 0 && (
                <div className="mt-2 text-muted-foreground">
                  Skipped {plan.skipped.length}: {Object.entries(plan.skipped.reduce<Record<string, number>>((a, s) => ((a[s.why.replace(/\d+ days? ago/, 'within cooldown')] = (a[s.why.replace(/\d+ days? ago/, 'within cooldown')] ?? 0) + 1), a), {})).map(([w, n]) => `${n} ${w}`).join(', ')}.
                </div>
              )}
            </div>
          )}

          {mail && (
            <div className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold">📮 Claim postcards</span>{' '}
                  <span className="text-muted-foreground">
                    {mail.mailable} mailable
                    {Object.keys(mail.blocked).length ? ` · blocked: ${Object.entries(mail.blocked).map(([k, n]) => `${n} ${k}`).join(', ')}` : ''}
                    {' · '}
                    {mail.cron.enabled ? `cron ON, ${mail.cron.maxMail}/night after ${mail.cron.minAgeHours}h review` : 'cron OFF (TRADE_PIPELINE_MAIL_ENABLED)'}
                    {!mail.lobConfigured ? ' · Lob not configured' : !mail.mailEnabled ? ' · POSTCARD_MAIL_ENABLED off' : ''}
                    {!mail.senderReady ? ' · ⚠️ sender profile needs name + email' : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={previewCards} disabled={busy} className="rounded-lg border border-border px-2 py-1 hover:bg-muted disabled:opacity-50">Preview</button>
                  <button type="button" onClick={() => mailCards(true)} disabled={busy || !mail.lobConfigured || !mail.mailEnabled} className="rounded-lg border border-border px-2 py-1 hover:bg-muted disabled:opacity-50">Mail test card</button>
                  <button type="button" onClick={() => mailCards(false)} disabled={busy || !mail.lobConfigured || !mail.mailEnabled || !mail.senderReady || !mail.mailable} className="rounded-lg bg-emerald-400 px-2 py-1 font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">Mail now</button>
                </div>
              </div>
              {mailMsg && <div className="mt-1 text-muted-foreground">{mailMsg}</div>}
            </div>
          )}
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
