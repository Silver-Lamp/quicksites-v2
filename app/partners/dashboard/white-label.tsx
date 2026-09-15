'use client';
// app/partners/dashboard/white-label.tsx
//
// The white-label activation checklist. Five steps a partner completes themselves; each one
// used to be an operator's hand step (docs/WHITE_LABEL_PLAN.md slice 4). State comes from
// GET /api/partners/brand; every action returns the refreshed state so the list never lies.
//
// Chrome is always dark (CLAUDE.md §7): semantic tokens + alpha tints only.
import { useCallback, useEffect, useRef, useState } from 'react';

type Step = { key: 'brand' | 'domain' | 'email' | 'payouts' | 'share'; status: 'done' | 'pending' | 'todo'; detail: string };
type Dns = { type: string; name: string; value: string };
type State = {
  steps: Step[];
  org: { id: string; slug: string; name: string; support_email: string | null; logo_url: string | null; dark_logo_url: string | null; accent: string | null } | null;
  domain: { host: string; verified: boolean; dns: Dns[] } | null;
  email: { domain: string; status: string | null; records: Array<{ record?: string; type?: string; name?: string; value?: string; status?: string }> } | null;
  payoutsActive: boolean;
  code: string | null;
};

const TITLES: Record<Step['key'], string> = {
  brand: '1. Your brand',
  domain: '2. Your domain',
  email: '3. Your email domain',
  payouts: '4. Payouts',
  share: '5. Invite merchants',
};

function Badge({ status }: { status: Step['status'] }) {
  const cls =
    status === 'done'
      ? 'bg-emerald-500/15 text-emerald-300'
      : status === 'pending'
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-zinc-800 text-neutral-400';
  const label = status === 'done' ? 'done' : status === 'pending' ? 'waiting on you' : 'to do';
  return <span className={`rounded px-1.5 py-px text-[10px] uppercase tracking-wide ${cls}`}>{label}</span>;
}

function RecordTable({ rows }: { rows: Array<{ type?: string; name?: string; value?: string; status?: string }> }) {
  if (!rows.length) return null;
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-xs">
        <thead className="bg-zinc-900/60 text-neutral-400">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">Type</th>
            <th className="px-3 py-1.5 text-left font-medium">Name</th>
            <th className="px-3 py-1.5 text-left font-medium">Value</th>
            <th className="px-3 py-1.5 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-zinc-800/80">
              <td className="px-3 py-1.5 font-mono text-neutral-200">{r.type}</td>
              <td className="px-3 py-1.5 font-mono text-neutral-200">{r.name}</td>
              <td className="px-3 py-1.5 font-mono text-neutral-300 break-all">{r.value}</td>
              <td className="px-3 py-1.5 text-neutral-400">{r.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
const btn = 'rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-zinc-800 disabled:opacity-50';
const btnPrimary = 'rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50';

export default function WhiteLabelChecklist() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [support, setSupport] = useState('');
  const [accent, setAccent] = useState('');
  const [host, setHost] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = useCallback((s: State) => {
    setState(s);
    if (s.org) {
      setName(s.org.name);
      setSupport(s.org.support_email ?? '');
      setAccent(s.org.accent ?? '');
    }
    if (s.domain) setHost(s.domain.host);
    if (s.email) setEmailDomain(s.email.domain);
  }, []);

  const call = useCallback(
    async (label: string, url: string, init: RequestInit) => {
      setBusy(label);
      setError(null);
      try {
        const res = await fetch(url, { cache: 'no-store', ...init });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) throw new Error(j?.error || `${res.status}`);
        apply(j as State);
      } catch (e: any) {
        setError(e?.message ?? 'failed');
      } finally {
        setBusy(null);
      }
    },
    [apply],
  );

  useEffect(() => {
    void call('load', '/api/partners/brand', { method: 'GET' });
  }, [call]);

  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  if (!state) return <div className="mt-8 text-xs text-neutral-500">{error ? `White-label: ${error}` : 'Loading white-label setup…'}</div>;
  const step = (k: Step['key']) => state.steps.find((s) => s.key === k)!;

  return (
    <section className="mt-8 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] p-5">
      <div className="text-sm font-medium text-indigo-200">Your white-label portal</div>
      <p className="mt-1 text-xs text-neutral-400">
        Your merchants see your brand, on your domain, from sign-up to dashboard. Work down the list; each step tells you what it is waiting on.
      </p>
      {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      <ol className="mt-4 space-y-4">
        {/* 1. Brand */}
        <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">{TITLES.brand} <Badge status={step('brand').status} /></div>
          <p className="mt-1 text-xs text-neutral-400">{step('brand').detail}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input className={input} placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} placeholder="support@yourbrand.com" value={support} onChange={(e) => setSupport(e.target.value)} />
            <input className={input} placeholder="Accent #0ea5e9 (optional)" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} disabled={busy !== null || name.trim().length < 2} onClick={() => call('brand', '/api/partners/brand', json({ name, support_email: support, accent }))}>
              {state.org ? 'Save brand' : 'Create my brand'}
            </button>
            {state.org && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append('file', f);
                  fd.append('tag', 'logo');
                  await call('logo', '/api/partners/brand/logo', { method: 'POST', body: fd });
                  e.target.value = '';
                }} />
                <button type="button" className={btn} disabled={busy !== null} onClick={() => fileRef.current?.click()}>
                  {state.org.logo_url ? 'Replace logo' : 'Upload logo'}
                </button>
                {state.org.logo_url && <img src={state.org.logo_url} alt="" className="h-8 max-w-[160px] rounded bg-zinc-800/60 object-contain px-2" />}
              </>
            )}
          </div>
        </li>

        {/* 2. Domain */}
        <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">{TITLES.domain} <Badge status={step('domain').status} /></div>
          <p className="mt-1 text-xs text-neutral-400">{step('domain').detail}</p>
          {state.org && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input className={`${input} md:max-w-xs`} placeholder="app.yourbrand.com" value={host} onChange={(e) => setHost(e.target.value)} disabled={!!state.domain?.verified} />
              {!state.domain?.verified && (
                <button type="button" className={btnPrimary} disabled={busy !== null || !host.trim()} onClick={() => call('domain', '/api/partners/brand/domain', json({ host }))}>
                  {state.domain ? 'Change domain' : 'Attach domain'}
                </button>
              )}
              {state.domain && !state.domain.verified && (
                <button type="button" className={btn} disabled={busy !== null} onClick={() => call('domain-check', '/api/partners/brand/domain', json({ check: true }))}>
                  Check DNS
                </button>
              )}
            </div>
          )}
          {state.domain && !state.domain.verified && (
            <>
              <p className="mt-3 text-xs text-neutral-400">Add this record at your DNS provider, then press Check DNS. Propagation can take up to an hour.</p>
              <RecordTable rows={state.domain.dns} />
            </>
          )}
        </li>

        {/* 3. Email */}
        <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">{TITLES.email} <Badge status={step('email').status} /></div>
          <p className="mt-1 text-xs text-neutral-400">{step('email').detail}</p>
          {state.org && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input className={`${input} md:max-w-xs`} placeholder="yourbrand.com" value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} disabled={state.email?.status === 'verified'} />
              {state.email?.status !== 'verified' && (
                <button type="button" className={btnPrimary} disabled={busy !== null || !emailDomain.trim()} onClick={() => call('email', '/api/partners/brand/email-domain', json({ domain: emailDomain }))}>
                  {state.email ? 'Change domain' : 'Add sending domain'}
                </button>
              )}
              {state.email && state.email.status !== 'verified' && (
                <button type="button" className={btn} disabled={busy !== null} onClick={() => call('email-check', '/api/partners/brand/email-domain', json({ check: true }))}>
                  Check records
                </button>
              )}
            </div>
          )}
          {state.email && state.email.status !== 'verified' && (
            <>
              <p className="mt-3 text-xs text-neutral-400">Add these records at your DNS provider, then press Check records.</p>
              <RecordTable rows={state.email.records.map((r) => ({ type: r.type ?? r.record, name: r.name, value: r.value, status: r.status }))} />
            </>
          )}
        </li>

        {/* 4. Payouts — the existing Stripe connect card sits above; this only reports. */}
        <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">{TITLES.payouts} <Badge status={step('payouts').status} /></div>
          <p className="mt-1 text-xs text-neutral-400">{step('payouts').detail} {!state.payoutsActive && 'Use the Payouts card above.'}</p>
        </li>

        {/* 5. Share */}
        <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">{TITLES.share} <Badge status={step('share').status} /></div>
          <p className="mt-1 text-xs text-neutral-400 break-all">{step('share').detail}</p>
        </li>
      </ol>
    </section>
  );
}
