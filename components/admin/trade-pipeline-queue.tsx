'use client';

// components/admin/trade-pipeline-queue.tsx
//
// The nightly pipeline's queue, on /admin/growth, rendered directly under the sweep form. A single
// city is queued from THAT form ("Queue for tonight" — one form names a city, two exits); this panel
// adds whole metros, lets the data plan the queue, shows what is queued, and mails the claim cards.
// The cron sweeps at its cap and builds drafts for every no-website business it finds. The panel
// says plainly whether the cron is ON — a queue that fills and never drains is the silent failure
// this feature would otherwise have.
import { useEffect, useState } from 'react';
import { LOW_YIELD_RATE } from '@/lib/tradeSites/queuePlanner';

/** Fired by the sweep form after it queues a city, so this panel refreshes without a reload. */
export const SWEEP_QUEUE_CHANGED = 'qs:sweep-queue:changed';

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
    // The sweep form above queues single cities; reflect them here without a reload.
    const onChanged = () => { void load(); setOpen(true); };
    window.addEventListener(SWEEP_QUEUE_CHANGED, onChanged);
    return () => window.removeEventListener(SWEEP_QUEUE_CHANGED, onChanged);
  }, []);

  /** Fan a whole metro (~30 cities) × one trade into the queue. Single cities come from the sweep form. */
  async function addMetro() {
    if (!metro) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/prospects/sweep-queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ metro, category }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error || 'Could not queue.');
        return;
      }
      setMsg(`Queued ${j.inserted}${j.rejected?.length ? `, rejected ${j.rejected.length}` : ''}.${j.enabled ? '' : ' ⚠️ The cron is OFF (TRADE_PIPELINE_ENABLED) — nothing will drain this.'}`);
      setMetro('');
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
  type Planned = { city: string; region: string; industry: string; category: string; priority: number; reasons: string[]; rate: number; measured: boolean };
  const [plan, setPlan] = useState<{ plan: Planned[]; skipped: Array<{ city: string; region: string; industry: string; why: string }> } | null>(null);
  // Which planned rows the operator has left ticked. All ticked to start; untick the low-yield ones.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const rowKey = (p: { city: string; region: string; category: string }) => `${p.city}|${p.region}|${p.category}`;
  async function planQueue(apply: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const rows = apply && plan ? plan.plan.filter((p) => ticked.has(rowKey(p))).map((p) => ({ city: p.city, region: p.region, category: p.category })) : undefined;
      const r = await fetch('/api/admin/prospects/sweep-queue/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 14, apply, rows }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error || 'Could not plan.');
        return;
      }
      if (apply) {
        const dup = j.skippedQueued ? ` ${j.skippedQueued} already queued, skipped.` : '';
        setMsg(`Added ${j.inserted} behind the ${j.queuedAhead} already queued.${dup}${j.enabled ? '' : ' ⚠️ The cron is OFF.'}`);
        setPlan(null);
        await load();
      } else {
        setPlan({ plan: j.plan, skipped: j.skipped });
        setTicked(new Set((j.plan as Planned[]).map(rowKey)));
      }
    } finally {
      setBusy(false);
    }
  }
  const tickedCount = plan ? plan.plan.filter((p) => ticked.has(rowKey(p))).length : 0;
  /** The calendar night the last ticked row would run: tonight is night 1 of the queue. */
  function lastNight(queuedAhead: number, adding: number, perNight: number): string {
    const nights = Math.ceil((queuedAhead + adding) / Math.max(1, perNight));
    const d = new Date();
    d.setDate(d.getDate() + Math.max(0, nights - 1));
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
      // ⚠️ The frames must match the card. #919 made the card LANDSCAPE (9.25in × 6.25in) but these
      // stayed portrait (6.2in × 9.2in), so the preview clipped the right third — where the QR is —
      // and the operator reported "the QR isn't showing" the night before the first real send. A
      // preview that lies about the artifact is worse than none; size it from one constant.
      const W = '9.25in';
      const H = '6.25in';
      const frame = (html: string, label: string) =>
        `<div><div style="font:600 12px system-ui;color:#374151;margin:0 0 6px">${label}</div><iframe style="width:${W};height:${H};border:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)" srcdoc="${html.replace(/"/g, '&quot;')}"></iframe></div>`;
      w.document.write(`<title>Claim card — ${c.businessName}</title><div style="display:flex;flex-direction:column;gap:24px;padding:16px;background:#e5e7eb;min-width:calc(${W} + 32px)">${frame(c.frontHtml, 'Front')}${frame(c.backHtml, 'Back — right 4.6in stays clear for the address block')}</div>`);
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
      // ⚠️ Say WHY. This used to print "0 sent, 0 blocked, 1 failed" and drop the error string the
      // server had put in results[] — so a Lob refusal the night before the first real send read
      // as "test card send failing" with nothing to act on.
      const failures: string[] = Array.isArray(j?.results)
        ? j.results.filter((x: any) => x && x.ok === false).map((x: any) => `${x.businessName ?? x.prospectId}: ${x.error ?? x.skipped ?? 'failed'}`)
        : [];
      const why = failures.length ? ` — ${failures.slice(0, 3).join(' · ')}${failures.length > 3 ? ` (+${failures.length - 3} more)` : ''}` : '';
      setMailMsg(!r.ok ? `Refused: ${j?.error || r.status}` : `${test ? 'Test card' : 'Mailed'}: ${j.mailed} sent, ${j.blocked} blocked, ${j.failed} failed${why}.`);
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
            {queued} queued · {state?.caps.maxSweeps ?? 1} swept a night. Add a city with “Queue for tonight” in the sweep form above; add a metro or let the data plan here. {open ? '▲' : '▼'}
          </div>
        </button>
      </div>

      {open && state && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col text-xs text-muted-foreground">
              Whole metro (fans out ~30 cities)
              <select value={metro} onChange={(e) => setMetro(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
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
            <button type="button" onClick={addMetro} disabled={busy || !metro} className="rounded-lg bg-emerald-400 px-3 py-1 font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">
              Queue the metro
            </button>
            <span className="pb-1 text-xs text-muted-foreground">or</span>
            <button type="button" onClick={() => planQueue(false)} disabled={busy} className="rounded-lg border border-border px-3 py-1 hover:bg-muted disabled:opacity-50" title="Rank city × trade pairs from the domains we own and the no-website rates we have measured">
              Plan the queue
            </button>
            <span className="grow" />
            {/* Spends Places calls now. Lives inside the panel, beside the queue it drains — it used
                to sit on the collapsed header where nothing said what it would do. */}
            <button type="button" onClick={runNow} disabled={busy} title={queued ? `Sweep the next queued row and build up to ${state.caps.maxBuilds} drafts now instead of at 06:00 UTC (spends Places API calls)` : `Nothing queued — runs the build step only (up to ${state.caps.maxBuilds} backlog drafts)`} className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
              ▶ Run tonight&apos;s pass now
            </button>
          </div>
          {msg && <div className="text-xs text-muted-foreground">{msg}</div>}

          {plan && (
            <div className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Proposed — tick what to add, in this order</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => setPlan(null)} className="rounded-lg border border-border px-2 py-1 hover:bg-muted">Discard</button>
                  <button type="button" onClick={() => planQueue(true)} disabled={busy || !tickedCount} className="rounded-lg bg-emerald-400 px-2 py-1 font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">
                    Add {tickedCount} after the {queued} queued
                  </button>
                </span>
              </div>
              {/* What the click does, in one sentence — the button used to say "Queue these 14" and
                  nothing else, and the first plan would have interleaved with the rows already queued. */}
              <div className="mt-1 text-muted-foreground">
                Adds {tickedCount} row{tickedCount === 1 ? '' : 's'} to the end of the queue. The cron takes {state.caps.maxSweeps} a night, so the last one runs around{' '}
                <span className="text-foreground">{lastNight(queued, tickedCount, state.caps.maxSweeps)}</span>. Nothing is spent until a row is swept; untick a row to leave it out.
              </div>
              <ol className="mt-2 space-y-1">
                {plan.plan.map((p, i) => {
                  const k = rowKey(p);
                  const on = ticked.has(k);
                  const lowYield = p.rate < LOW_YIELD_RATE;
                  return (
                    <li key={k} className={`flex items-start gap-2 ${on ? '' : 'opacity-50'}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setTicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                        className="mt-0.5 shrink-0"
                        aria-label={`Include ${p.city}, ${p.region} ${p.category}`}
                      />
                      <span className="w-5 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
                      <span>
                        <span className="font-medium">{p.city}, {p.region}</span> · {p.category}
                        {lowYield && (
                          <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] text-amber-300" title={`${Math.round(p.rate * 100)}% of these businesses have no website — a 20-business sweep yields about ${Math.max(1, Math.round(p.rate * 20))} draft${Math.round(p.rate * 20) === 1 ? '' : 's'}`}>
                            low yield
                          </span>
                        )}{' '}
                        <span className="text-muted-foreground">— {p.reasons.join('; ')}</span>
                      </span>
                    </li>
                  );
                })}
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
