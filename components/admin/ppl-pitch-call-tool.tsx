'use client';
// components/admin/ppl-pitch-call-tool.tsx — "Prepare the call" under each Pitch-now line.
//
// Four tabs: the facts + advice (rules over the row), the script as a walker (click what they
// said, read what to say next), the same tree as a flow chart (pure SVG, current node lit), and
// the "they said yes" steps with the two server actions (create the account + deposit link,
// text the link) and the editor link for the rename. Dark chrome tokens only.
import { useMemo, useState } from 'react';
import type { PitchPlan, ScriptNode } from '@/lib/ppl/pitchPlan';
import { usd } from '@/lib/ppl/pitchPlan';

type Tab = 'facts' | 'script' | 'flow' | 'yes';

export default function PplPitchCallTool({ plan }: { plan: PitchPlan }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('facts');
  const [at, setAt] = useState<string>(plan.script[0]?.id ?? 'open');
  const [trail, setTrail] = useState<string[]>([]);
  const byId = useMemo(() => new Map(plan.script.map((n) => [n.id, n])), [plan.script]);
  const node = byId.get(at) ?? plan.script[0];

  function go(next: string) {
    setTrail((t) => [...t, at]);
    setAt(next);
  }
  function back() {
    setTrail((t) => {
      const prev = t[t.length - 1];
      if (prev) setAt(prev);
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
            {(['facts', 'script', 'flow', 'yes'] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded px-2 py-1 ${tab === t ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>
                {t === 'facts' ? 'Facts & advice' : t === 'script' ? 'Script' : t === 'flow' ? 'Flow chart' : 'They said yes'}
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
              <p className="text-muted-foreground">Deal as the script states it: {usd(plan.deal.cplCents)} per call ≥{plan.deal.minBillableSeconds} s · {usd(plan.deal.depositCents)} to start (~{plan.deal.leadsInDeposit} calls) · reload {usd(plan.deal.reloadAmountCents)} under {usd(plan.deal.reloadThresholdCents)}.</p>
            </div>
          )}

          {tab === 'script' && node && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{node.title}</span>
                <span className="space-x-2">
                  {trail.length > 0 && <button type="button" onClick={back} className="underline text-muted-foreground">back</button>}
                  <button type="button" onClick={restart} className="underline text-muted-foreground">start over</button>
                </span>
              </div>
              <p className="mt-2 rounded border border-border bg-card p-3 text-sm leading-relaxed text-card-foreground">{node.say}</p>
              {node.kind === 'ask' && node.options && (
                <div className="mt-2">
                  <div className="text-[11px] text-muted-foreground">They say…</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {node.options.map((o) => <button key={o.label} type="button" onClick={() => go(o.next)} className="rounded border border-border px-2 py-1 hover:bg-muted">{o.label}</button>)}
                  </div>
                </div>
              )}
              {node.kind === 'say' && node.next && (
                <button type="button" onClick={() => go(node.next!)} className="mt-2 rounded bg-primary px-3 py-1 text-primary-foreground">Then →</button>
              )}
              {node.kind === 'end' && (
                <p className="mt-2 text-muted-foreground">
                  {node.outcome === 'yes' ? 'Now the "They said yes" tab — all four steps in this sitting.' : node.outcome === 'later' ? 'Text the deposit link anyway; nothing bills until they use it.' : 'Nothing changes on the line. Note it on the campaign.'}
                </p>
              )}
            </div>
          )}

          {tab === 'flow' && <FlowChart plan={plan} current={at} />}

          {tab === 'yes' && <OnYes plan={plan} />}
        </div>
      )}
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

function OnYes({ plan }: { plan: PitchPlan }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function createAccount() {
    setBusy('account');
    const r = await fetch('/api/admin/ppl/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ geo_campaign_id: plan.campaignId, business_name: plan.facts.business, cpl_cents: plan.deal.cplCents, min_billable_seconds: plan.deal.minBillableSeconds, reload_threshold_cents: plan.deal.reloadThresholdCents, reload_amount_cents: plan.deal.reloadAmountCents, deposit_cents: plan.deal.depositCents }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.checkout_url) { setLink(j.checkout_url); setMsg(`Account created (pending until the deposit lands). Deposit link for ${usd(j.deposit_cents)} ready.`); }
    else setMsg(`Not created: ${j?.error || r.status}`);
    setBusy(null);
  }
  async function textLink() {
    if (!link) return;
    setBusy('text');
    const body = `QuickSites: here is the link to start the pay-per-call line for ${plan.facts.domain} — ${usd(plan.deal.depositCents)} to begin, ${usd(plan.deal.cplCents)} per answered call of ${plan.deal.minBillableSeconds} s or more, nothing billed until the deposit lands: ${link} Reply STOP any time to stop.`;
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
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" disabled={busy !== null || !!link} onClick={createAccount} className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{link ? 'Account created' : busy === 'account' ? 'Creating…' : `Create account + ${usd(plan.deal.depositCents)} deposit link`}</button>
        <button type="button" disabled={!link || busy !== null} onClick={textLink} className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-50">{busy === 'text' ? 'Texting…' : 'Text them the link'}</button>
        {plan.templateId ? <a href={`/admin/templates/${plan.templateId}`} className="underline" target="_blank" rel="noreferrer">Open the site in the editor (rename it)</a> : <span className="text-muted-foreground">No pitch site on this campaign to rename.</span>}
        <a href="/status" className="underline text-muted-foreground" target="_blank" rel="noreferrer">/status (the ppl gate)</a>
      </div>
      {link && <p className="break-all text-muted-foreground">Deposit link: {link}</p>}
      {msg && <p role="status" className="rounded border border-border bg-muted px-2 py-1">{msg}</p>}
    </div>
  );
}
