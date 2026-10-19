'use client';
// components/admin/ppl-pitch-call-tool.tsx — "Prepare the call" under each Pitch-now line.
//
// Four tabs: the facts + advice (rules over the row), the script as a walker (click what they
// said, read what to say next), the same tree as a flow chart (pure SVG, current node lit), and
// the "they said yes" steps with the two server actions (create the account + deposit link,
// text the link) and the editor link for the rename. Dark chrome tokens only.
import { useEffect, useMemo, useRef, useState } from 'react';
// ⚠️ TYPE-ONLY from pitchPlan. That module runs on the server (it reaches the corpus and, since
// the outcome survey, the Supabase admin client); a value import here bundles it for the
// browser, where `createClient` throws "supabaseKey is required" and the whole page dies.
import type { PitchPlan, ScriptNode, DealKey } from '@/lib/ppl/pitchPlan';
import { usd } from '@/lib/ppl/money';

/** One step already taken on the call: the node we were on and what they said to leave it. */
type TrailStep = { nodeId: string; title: string; said: string | null };

type Tab = 'facts' | 'text' | 'script' | 'flow' | 'yes';

export default function PplPitchCallTool({ plan }: { plan: PitchPlan }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('facts');
  const [at, setAt] = useState<string>(plan.script[0]?.id ?? 'open');
  const [trail, setTrail] = useState<TrailStep[]>([]);
  // The deal the owner will create the account on: set by the yes the script ended on, and
  // changeable on the "They said yes" tab (a call can end off-script).
  const [dealKey, setDealKey] = useState<DealKey>('next');
  const byId = useMemo(() => new Map(plan.script.map((n) => [n.id, n])), [plan.script]);
  const node = byId.get(at) ?? plan.script[0];

  function go(next: string, said: string | null) {
    const cur = byId.get(at);
    setTrail((t) => [...t, { nodeId: at, title: cur?.title ?? at, said }]);
    setAt(next);
    const dest = byId.get(next);
    if (dest?.deal) setDealKey(dest.deal);
  }
  function back() {
    setTrail((t) => {
      const prev = t[t.length - 1];
      if (prev) setAt(prev.nodeId);
      return t.slice(0, -1);
    });
  }
  function restart() { setTrail([]); setAt(plan.script[0]?.id ?? 'open'); }

  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted" aria-expanded={open}>
        {open ? 'Hide' : 'Prepare the call'} {plan.order.rank === 1 && plan.order.of > 1 ? '· call this one first' : ''}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-background/60 p-3 text-xs" data-pitch-tool>
          <div className="flex flex-wrap gap-1">
            {(['facts', 'text', 'script', 'flow', 'yes'] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded px-2 py-1 ${tab === t ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>
                {t === 'facts' ? 'Facts & advice' : t === 'text' ? 'By text' : t === 'script' ? 'Script (call)' : t === 'flow' ? 'Flow chart' : 'They said yes'}
              </button>
            ))}
          </div>

          {tab === 'facts' && (
            <div className="mt-3 space-y-3">
              <p className="font-medium">Call order: {plan.order.rank} of {plan.order.of} <span className="font-normal text-muted-foreground">— {plan.order.reason}</span></p>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">What they already saw</div>
                <ul className="mt-1 list-disc pl-4">
                  {plan.facts.leads.map((l) => <li key={l.at}>{l.whenLabel} — {l.minutesLabel}, customer-read, answered by {plan.facts.business}.</li>)}
                  <li>{plan.facts.dials} forwarded dials: {plan.facts.answered} answered, {plan.facts.unanswered} rang out.</li>
                  <li>{plan.facts.impressions28d ?? 0} impressions / {plan.facts.clicks28d ?? 0} clicks in the latest 28 days; {plan.facts.rankStatus === 'page1' ? `page one, position ${plan.facts.rankPosition ?? '?'}` : `position ${plan.facts.rankPosition ?? 'unknown'}`}; line {plan.facts.ageDays ?? '?'} days old.</li>
                </ul>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Advice (rules over this row)</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">{plan.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
              <p className="text-muted-foreground">
                Deals as the script states them, calls ≥{plan.minBillableSeconds} s only: <span className="text-foreground">{plan.deals.next.label}</span> — {usd(plan.deals.next.cplCents)} now, then {usd(plan.deals.next.cplCents)} charged as each one posts (always one ahead) · <span className="text-foreground">{plan.deals.package.label}</span> — {usd(plan.deals.package.cplCents)} a lead, tops up {usd(plan.deals.package.reloadAmountCents)} under {usd(plan.deals.package.reloadThresholdCents)}, unused refundable on request.
              </p>
            </div>
          )}

          {tab === 'text' && <ByText plan={plan} dealKey={dealKey} setDealKey={setDealKey} />}

          {tab === 'script' && node && (
            <ScriptWalker node={node} trail={trail} total={plan.script.length} onGo={go} onBack={back} onRestart={restart} onYes={() => setTab('yes')} />
          )}

          {tab === 'flow' && <FlowChart plan={plan} current={at} />}

          {tab === 'yes' && <OnYes plan={plan} dealKey={dealKey} setDealKey={setDealKey} />}
        </div>
      )}
    </div>
  );
}

/**
 * The call console. Left rail: a large Back (the thing you reach for mid-call), Start over, and
 * the trail of what they have said so far. Right: what to say now at reading size, then their
 * likely replies as numbered targets you can hit with a thumb or a digit key. Keys: ← or
 * Backspace = back · 1–9 = their reply · Enter = Then · R = start over (never while typing).
 */
function ScriptWalker({ node, trail, total, onGo, onBack, onRestart, onYes }: {
  node: ScriptNode;
  trail: TrailStep[];
  total: number;
  onGo: (next: string, said: string | null) => void;
  onBack: () => void;
  onRestart: () => void;
  onYes: () => void;
}) {
  const canBack = trail.length > 0;
  const cameFrom = trail[trail.length - 1];
  const options = node.kind === 'ask' ? node.options ?? [] : [];

  // Keys are handled on the walker itself, not the window: two open tools must not both answer
  // the same digit. The walker takes focus when it mounts and after each step so keys land.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, [node.id]);
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && canBack) { e.preventDefault(); onBack(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); onRestart(); return; }
    if (e.key === 'Enter' && node.kind === 'say' && node.next) { e.preventDefault(); onGo(node.next, null); return; }
    const n = Number(e.key);
    if (node.kind === 'ask' && Number.isInteger(n) && n >= 1 && n <= options.length) { e.preventDefault(); const o = options[n - 1]; onGo(o.next, o.label); }
  }

  return (
    <div ref={rootRef} tabIndex={-1} onKeyDown={onKey} className="mt-3 grid gap-3 outline-none sm:grid-cols-[9rem_1fr]" data-script-walker>
      {/* Left rail */}
      <div className="flex flex-row gap-2 sm:flex-col">
        <button type="button" onClick={onBack} disabled={!canBack} aria-keyshortcuts="ArrowLeft Backspace"
          className="flex min-h-[4.5rem] flex-1 flex-col items-center justify-center rounded-lg border border-border bg-card text-card-foreground hover:bg-muted disabled:opacity-40 sm:flex-none">
          <span className="text-2xl leading-none">←</span>
          <span className="mt-1 text-sm font-medium">Back</span>
          {cameFrom && <span className="mt-0.5 max-w-[8rem] truncate px-1 text-[10px] text-muted-foreground">to “{cameFrom.title}”</span>}
        </button>
        <button type="button" onClick={onRestart} aria-keyshortcuts="r" className="rounded-lg border border-border px-2 py-2 text-xs hover:bg-muted">Start over</button>
        {trail.length > 0 && (
          <ol className="hidden text-[11px] text-muted-foreground sm:block">
            {trail.map((s, i) => (
              <li key={i} className="mt-1 border-l-2 border-border pl-2">
                <div className="truncate">{s.title}</div>
                {s.said && <div className="truncate italic">“{s.said}”</div>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* What to say now */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{node.title}</span>
          <span className="text-[11px] text-muted-foreground">step {trail.length + 1}{cameFrom?.said ? ` · after “${cameFrom.said}”` : ''}</span>
        </div>
        <p className="mt-2 rounded-lg border border-border bg-card p-4 text-base leading-relaxed text-card-foreground sm:text-lg">{node.say}</p>
        {node.kind === 'ask' && options.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">They say… <span className="normal-case">(or press the number)</span></div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {options.map((o, i) => (
                <button key={o.label} type="button" onClick={() => onGo(o.next, o.label)} aria-keyshortcuts={String(i + 1)}
                  className="flex min-h-[3rem] items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">{i + 1}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {node.kind === 'say' && node.next && (
          <button type="button" onClick={() => onGo(node.next!, null)} aria-keyshortcuts="Enter" className="mt-3 min-h-[3rem] w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground sm:w-auto sm:px-8">Then → <span className="ml-2 text-xs font-normal opacity-70">Enter</span></button>
        )}
        {node.kind === 'end' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground">
              {node.outcome === 'yes' ? 'Now the four steps, in this sitting.' : node.outcome === 'later' ? 'Text the deposit link anyway; nothing bills until they use it.' : 'Nothing changes on the line. Note it on the campaign.'}
            </p>
            {node.outcome === 'yes' && <button type="button" onClick={onYes} className="min-h-[3rem] rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground">They said yes →</button>}
          </div>
        )}
        <p className="mt-3 text-[10px] text-muted-foreground">Keys: ← or Backspace back · 1–9 their reply · Enter then · R start over.</p>
      </div>
    </div>
  );
}

function FlowChart({ plan, current }: { plan: PitchPlan; current: string }) {
  const [large, setLarge] = useState(false);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Round = a question, you wait · square = you speak · dotted = an objection loops back to the offer · green/amber/red = yes / later / no. The lit node is where the Script tab is.</p>
        <button type="button" onClick={() => setLarge(true)} className="ml-2 shrink-0 rounded border border-border px-2 py-0.5 hover:bg-muted">Open large</button>
      </div>
      <FlowSvg plan={plan} current={current} fit />
      {large && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Call script flow chart, full size" onClick={() => setLarge(false)}>
          <div className="max-h-full max-w-6xl overflow-auto rounded-lg border border-border bg-card p-4 text-card-foreground" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-between text-xs"><span className="font-medium">{plan.facts.domain} — the call, as a flow chart</span><button type="button" onClick={() => setLarge(false)} className="underline">close</button></div>
            <FlowSvg plan={plan} current={current} />
          </div>
        </div>
      )}
    </div>
  );
}

function FlowSvg({ plan, current, fit }: { plan: PitchPlan; current: string; fit?: boolean }) {
  const f = plan.flow;
  const pos = new Map(f.nodes.map((n) => [n.id, n]));
  const optionCount = new Map(plan.script.map((n) => [n.id, n.options?.length ?? 0]));
  return (
    <div className={fit ? 'mt-2 w-full' : 'mt-2 overflow-x-auto'}>
      <svg width={fit ? '100%' : f.width} height={fit ? undefined : f.height} viewBox={`0 0 ${f.width} ${f.height}`} role="img" aria-label="Call script as a flow chart" className={fit ? 'h-auto w-full' : 'max-w-none'}>
        <defs>
          <marker id="pitch-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" opacity="0.5" /></marker>
        </defs>
        {f.edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
          const up = y2 <= y1; // a loop back (e.g. an objection → the offer)
          const d = up
            ? `M${x1},${y1} C${x1},${y1 + 30} ${x2 + 70},${y2 - 30} ${x2 + 20},${y2}`
            : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
          return (
            <g key={i} className="text-foreground">
              <path d={d} fill="none" stroke="currentColor" strokeOpacity={up ? 0.25 : 0.45} strokeDasharray={up ? '4 3' : undefined} markerEnd="url(#pitch-arrow)" />
              {/* Edge labels only where they fit: a node with many replies has their titles on the target boxes already. */}
              {e.label && !up && (optionCount.get(e.from) ?? 0) <= 3 && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.7">{e.label.length > 22 ? e.label.slice(0, 21) + '…' : e.label}</text>}
            </g>
          );
        })}
        {f.nodes.map((n) => {
          const lit = n.id === current;
          const tone = n.kind === 'end' ? (n.outcome === 'yes' ? '#10b981' : n.outcome === 'later' ? '#f59e0b' : '#f43f5e') : n.kind === 'ask' ? '#60a5fa' : '#a1a1aa';
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.kind === 'ask' ? 22 : 6} fill={tone} fillOpacity={lit ? 0.35 : 0.12} stroke={tone} strokeOpacity={lit ? 1 : 0.6} strokeWidth={lit ? 2 : 1} />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} fontSize="11" textAnchor="middle" fill="currentColor" className="text-foreground">{n.title}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type PitchState = {
  funnel: { deal: DealKey | null; textedAt: string | null; followupAt: string | null; followupKind: 'repoint' | 'last_free' | null; repointBy: string | null; calledAt: string | null; result: string | null };
  next: { step: 'text1' | 'text2' | 'call' | 'repoint' | 'done'; why: string };
  account: { status: string; balance_cents: number } | null;
  to: string | null;
  lead: { at: string; seconds: number; callerPhone: string | null } | null;
  alternative: { id: string; name: string; phone: string | null; vetted: boolean; stored: boolean } | null;
  preview: { text1: string; text2: string; text2Kind: 'repoint' | 'last_free'; text2By: string | null };
  sentBy?: 'operator' | 'cron' | null;
  replies?: Array<{ received_at: string; body: string; direction: 'in' | 'out'; kind: 'stop' | 'start' | 'outcome' | 'reply' | null; reason: string | null; ok: boolean | null }>;
  window?: { ok: boolean; tz: string; local: string; reason?: 'weekend' | 'outside_hours'; next: string | null };
};

/**
 * Text first, call second (owner, 2026-10-18). Day 0: the call they got + the deal + the link
 * that IS the yes + terms. Day 3: the honest follow-up — a real re-point name and date where
 * another no-website shop exists in the city, else "that was the last free one". Then the call,
 * opening with the text. Every send is from the server; the funnel is stamped on the campaign.
 */
function ByText({ plan, dealKey, setDealKey }: { plan: PitchPlan; dealKey: DealKey; setDealKey: (k: DealKey) => void }) {
  const [state, setState] = useState<PitchState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  async function load() {
    const r = await fetch(`/api/admin/ppl/pitch?campaignId=${plan.campaignId}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (r.ok) { setState(j); if (j?.funnel?.deal) setDealKey(j.funnel.deal); } else setMsg(`Could not load: ${j?.error || r.status}`);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [plan.campaignId]);

  async function act(action: 'text1' | 'text2' | 'called' | 'result' | 'vet' | 'reject_alt', extra: Record<string, unknown> = {}) {
    const label = action === 'text1' ? 'Send text 1' : action === 'text2' ? 'Send the follow-up' : action;
    if ((action === 'text1' || action === 'text2') && !window.confirm(`${label} to ${state?.to ?? 'the business'} now?`)) return;
    setBusy(action);
    const r = await fetch('/api/admin/ppl/pitch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId: plan.campaignId, action, dealKey, ...extra }) });
    const j = await r.json().catch(() => null);
    setMsg(r.ok ? (j?.sent ? `Sent to ${j.to}${j.accountCreated ? ' (account created, pending until they pay)' : ''}.` : 'Recorded.') : `Failed: ${j?.detail || j?.error || r.status}`);
    await load();
    setBusy(null);
  }

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null);
  const f = state?.funnel;
  const chip = (label: string, at: string | null, extra?: string | null) => (
    <span className={`rounded-full border px-2 py-0.5 ${at ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border text-muted-foreground'}`}>{label}{at ? ` · ${when(at)}` : ''}{extra ? ` · ${extra}` : ''}</span>
  );

  return (
    <div className="mt-3 space-y-3">
      {!state && !msg && <p className="text-muted-foreground">Loading the funnel…</p>}
      {state && f && (
        <>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {chip('Text 1', f.textedAt, f.deal ? plan.deals[f.deal].label : null)}
            {chip('Follow-up', f.followupAt, f.followupKind === 'repoint' ? `re-point by ${f.repointBy}` : f.followupKind === 'last_free' ? 'last free' : null)}
            {chip('Called', f.calledAt)}
            {chip('Result', f.result ? 'x' : null, f.result)}
            {state.account && <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">account {state.account.status} · {usd(state.account.balance_cents)}</span>}
          </div>
          <p className="rounded border border-border bg-muted px-3 py-2"><span className="font-medium">Next: </span>{state.next.why}</p>
          {state.window && (
            <p className="text-[11px] text-muted-foreground">
              Their clock: {state.window.local} ({state.window.tz.split('/').pop()?.replace('_', ' ')}). {state.window.ok ? 'Inside their texting window now.' : `Outside their texting window (${state.window.reason === 'weekend' ? 'weekend' : 'off hours'}) — the cron would wait for ${state.window.next}; a button here sends regardless.`}
              {state.sentBy ? ` Last text sent by the ${state.sentBy}.` : ''}
            </p>
          )}

          {!f.textedAt && (
            <fieldset className="rounded border border-border p-2">
              <legend className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">Deal in the text</legend>
              <div className="flex flex-wrap gap-3">
                {(Object.values(plan.deals) as Array<PitchPlan['deals'][DealKey]>).map((d) => (
                  <label key={d.key} className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 ${dealKey === d.key ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <input type="radio" name={`tdeal-${plan.campaignId}`} checked={dealKey === d.key} onChange={() => setDealKey(d.key)} />
                    <span>{d.label} <span className="text-muted-foreground">· {usd(d.depositCents)} now, {usd(d.cplCents)} a lead</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
              <div className="flex items-baseline justify-between"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Text 1 — day 0</span>{f.textedAt && <span className="text-[11px] text-emerald-600 dark:text-emerald-300">sent {when(f.textedAt)}</span>}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{state.preview.text1}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">The pay link is minted at send (the account is created pending; the line stays free until they pay). {state.lead ? '' : 'No customer-read call ≥ the floor on this line — the text will say "the calls you have taken" instead of naming one.'}</p>
              <button type="button" disabled={busy !== null || !!f.textedAt || !state.to} onClick={() => act('text1')} className="mt-2 rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{f.textedAt ? 'Text 1 sent' : busy === 'text1' ? 'Sending…' : `Send text 1 to ${state.to ?? '—'}`}</button>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
              <div className="flex items-baseline justify-between"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Text 2 — day {3}, {state.preview.text2Kind === 'repoint' ? 'a real re-point' : 'last free one'}</span>{f.followupAt && <span className="text-[11px] text-emerald-600 dark:text-emerald-300">sent {when(f.followupAt)}</span>}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{state.preview.text2}</p>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {state.alternative ? (
                  <>
                    <div>
                      Next business in line: <span className="text-foreground">{state.alternative.name}</span>{state.alternative.phone ? ` · ${state.alternative.phone}` : ''}
                      {' '}— {state.alternative.vetted ? <span className="text-emerald-600 dark:text-emerald-300">vetted</span> : <span className="text-amber-600 dark:text-amber-300">not vetted yet</span>}.
                      {' '}The follow-up promises them the line by a date, so look at their listing and dial them from an ordinary phone first; it is held until you mark one of these.
                    </div>
                    {!f.followupAt && (
                      <div className="mt-1 flex gap-2">
                        <button type="button" disabled={busy !== null || state.alternative.vetted || !state.alternative.stored} onClick={() => act('vet')} className="rounded border border-emerald-500/50 px-2 py-0.5 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300">{state.alternative.vetted ? 'Vetted' : 'Mark vetted'}</button>
                        <button type="button" disabled={busy !== null || !state.alternative.stored} onClick={() => { if (window.confirm(`Not suitable: ${state.alternative?.name}? The next candidate is picked, or the text says "last free one".`)) void act('reject_alt'); }} className="rounded border border-border px-2 py-0.5 hover:bg-muted disabled:opacity-50">Not suitable</button>
                        {!state.alternative.stored && <span className="self-center">(chosen when text 1 goes out)</span>}
                      </div>
                    )}
                  </>
                ) : 'No other no-website shop in this city and trade, so the text says "last free one" — never a bluff.'}
              </div>
              <button type="button" disabled={busy !== null || !f.textedAt || !!f.followupAt || (!!state.alternative && state.alternative.stored && !state.alternative.vetted)} onClick={() => act('text2')} className="mt-2 rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{f.followupAt ? 'Follow-up sent' : busy === 'text2' ? 'Sending…' : state.alternative && state.alternative.stored && !state.alternative.vetted ? 'Vet them first' : 'Send the follow-up'}</button>
            </div>
          </div>

          {state.replies && state.replies.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">The text thread{state.replies.some((r) => r.direction === 'in') ? ' — they texted back' : ''}</div>
              <ul className="mt-1 space-y-1">
                {state.replies.map((r, i) => (
                  <li key={i} className={r.direction === 'in' ? '' : 'text-muted-foreground'}>
                    <span className="text-muted-foreground">{new Date(r.received_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} {r.direction === 'in' ? '← them' : `→ us${r.reason ? ` (${r.reason})` : ''}${r.ok === false ? ' FAILED' : ''}`}{r.kind && r.kind !== 'reply' ? ` · ${r.kind.toUpperCase()}` : ''}:</span> <span className={r.direction === 'in' ? 'text-foreground' : ''}>{r.body}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted-foreground">No automatic reply was sent. Call them, opening with what they wrote; if they want to pay, Resend the pay link on "They said yes".</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button type="button" disabled={busy !== null || !!f.calledAt} onClick={() => act('called')} className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-50">{f.calledAt ? `Called ${when(f.calledAt)}` : 'Mark: I called'}</button>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="what they said…" className="min-w-[14rem] flex-1 rounded border border-border bg-background px-2 py-1" />
            {(['paid', 'later', 'no', 'no_reply', 'repointed'] as const).map((r) => (
              <button key={r} type="button" disabled={busy !== null} onClick={() => act('result', { result: r, notes })} className={`rounded border px-2 py-1 hover:bg-muted disabled:opacity-50 ${f.result === r ? 'border-primary bg-primary/10' : 'border-border'}`}>{r.replace('_', ' ')}</button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">"Paid" is recorded by hand here; the account itself goes active the moment the deposit lands, with or without this. Terms the text links to: <a href="/leads/terms" target="_blank" rel="noreferrer" className="underline">/leads/terms</a>.</p>
        </>
      )}
      {msg && <p role="status" className="rounded border border-border bg-muted px-2 py-1">{msg}</p>}
    </div>
  );
}

function OnYes({ plan, dealKey, setDealKey }: { plan: PitchPlan; dealKey: DealKey; setDealKey: (k: DealKey) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const deal = plan.deals[dealKey];
  // Once the pitch text went out the account already exists (pending): the yes on the phone is
  // "resend the link while we're on", not "create the account".
  const texted = !!plan.facts.pitch.textedAt;

  async function resendLink() {
    setBusy('resend');
    const r = await fetch('/api/admin/ppl/pitch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId: plan.campaignId, action: 'resend', dealKey }) });
    const j = await r.json().catch(() => null);
    setMsg(r.ok ? `Resent the pay link to ${j?.to}.` : `Resend failed: ${j?.detail || j?.error || r.status}`);
    setBusy(null);
  }

  async function createAccount() {
    setBusy('account');
    const r = await fetch('/api/admin/ppl/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ geo_campaign_id: plan.campaignId, business_name: plan.facts.business, cpl_cents: deal.cplCents, min_billable_seconds: plan.minBillableSeconds, reload_threshold_cents: deal.reloadThresholdCents, reload_amount_cents: deal.reloadAmountCents, deposit_cents: deal.depositCents }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.checkout_url) { setLink(j.checkout_url); setMsg(`Account created (pending until the deposit lands). Deposit link for ${usd(j.deposit_cents)} ready.`); }
    else setMsg(`Not created: ${j?.error || r.status}`);
    setBusy(null);
  }
  async function textLink() {
    if (!link) return;
    setBusy('text');
    const body = dealKey === 'next'
      ? `QuickSites: here is the link to pay for the next call from ${plan.facts.domain} — ${usd(deal.cplCents)} now, then ${usd(deal.cplCents)} charged as each answered call of ${plan.minBillableSeconds} s or more comes in, always one ahead; nothing billed until this lands: ${link} Reply STOP any time to stop.`
      : `QuickSites: here is the link to start the pay-per-call line for ${plan.facts.domain} — ${usd(deal.depositCents)} for ${deal.leads} answered calls of ${plan.minBillableSeconds} s or more (${usd(deal.cplCents)} each, unused refundable on request), nothing billed until the deposit lands: ${link} Reply STOP any time to stop.`;
    const r = await fetch('/api/admin/ppl/text-business', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId: plan.campaignId, body }) });
    const j = await r.json().catch(() => null);
    setMsg(r.ok ? 'Texted the deposit link to the business.' : `Text failed: ${j?.error || r.status}`);
    setBusy(null);
  }
  return (
    <div className="mt-3 space-y-2">
      <ol className="list-decimal space-y-2 pl-4">
        {plan.onYes.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <fieldset className="rounded border border-border p-2">
        <legend className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">The deal they took</legend>
        <div className="flex flex-wrap gap-3">
          {(Object.values(plan.deals) as Array<PitchPlan['deals'][DealKey]>).map((d) => (
            <label key={d.key} className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 ${dealKey === d.key ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <input type="radio" name={`deal-${plan.campaignId}`} checked={dealKey === d.key} onChange={() => setDealKey(d.key)} disabled={!!link} />
              <span>{d.label} <span className="text-muted-foreground">· {usd(d.depositCents)} now, {usd(d.cplCents)} a lead</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {texted ? (
          <button type="button" disabled={busy !== null} onClick={resendLink} className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{busy === 'resend' ? 'Resending…' : `Resend the pay link (${deal.label})`}</button>
        ) : (
          <>
            <button type="button" disabled={busy !== null || !!link} onClick={createAccount} className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{link ? 'Account created' : busy === 'account' ? 'Creating…' : `Create account + ${usd(deal.depositCents)} deposit link`}</button>
            <button type="button" disabled={!link || busy !== null} onClick={textLink} className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-50">{busy === 'text' ? 'Texting…' : 'Text them the link'}</button>
          </>
        )}
        {plan.templateId ? <a href={`/admin/templates/${plan.templateId}`} className="underline" target="_blank" rel="noreferrer">Open the site in the editor (rename it)</a> : <span className="text-muted-foreground">No pitch site on this campaign to rename.</span>}
        <a href="/status" className="underline text-muted-foreground" target="_blank" rel="noreferrer">/status (the ppl gate)</a>
      </div>
      {link && <p className="break-all text-muted-foreground">Deposit link: {link}</p>}
      {msg && <p role="status" className="rounded border border-border bg-muted px-2 py-1">{msg}</p>}
    </div>
  );
}
