'use client';

// components/service-jobs/shop-jobs-client.tsx
//
// SecondSet shop console. Create a job, mint the per-job glasses capture token (the tech
// binds their glasses session to it), propose line items, and watch the customer's
// approve/decline land. Auth is enforced by the API routes; a 401 shows a sign-in prompt.

import * as React from 'react';
import type { ServiceJob, ServiceJobDetail } from '@/lib/serviceJobs/types';

const dollars = (cents: number) => (cents / 100).toFixed(2);

type DraftItem = { description: string; amount: string };

export default function ShopJobsClient() {
  const [auth, setAuth] = React.useState<'loading' | 'ok' | 'unauth' | 'disabled'>('loading');
  const [jobs, setJobs] = React.useState<ServiceJob[]>([]);
  const [sel, setSel] = React.useState<ServiceJobDetail | null>(null);
  const [form, setForm] = React.useState({ title: '', customer_email: '', customer_name: '', vehicle_ref: '' });
  const [draft, setDraft] = React.useState<DraftItem[]>([]);
  const [tokenInfo, setTokenInfo] = React.useState<{ capture_token: string; expires_at: string; qr_data_url?: string | null } | null>(null);
  const [voiceText, setVoiceText] = React.useState('');
  const [voiceMsg, setVoiceMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [hasGrant, setHasGrant] = React.useState(false);
  const [grantInput, setGrantInput] = React.useState('');
  const [syncMsg, setSyncMsg] = React.useState('');

  const loadJobs = React.useCallback(async () => {
    const res = await fetch('/api/service-jobs');
    if (res.status === 401) return setAuth('unauth');
    if (res.status === 404) return setAuth('disabled');
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setAuth('ok');
  }, []);

  React.useEffect(() => { loadJobs().catch(() => setAuth('unauth')); }, [loadJobs]);
  React.useEffect(() => { fetch('/api/service-jobs/grant').then((r) => r.ok ? r.json() : null).then((d) => d && setHasGrant(!!d.hasGrant)).catch(() => {}); }, []);

  async function saveGrant() {
    if (!grantInput.trim()) return;
    setBusy(true); setSyncMsg('');
    try {
      const res = await fetch('/api/service-jobs/grant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grantToken: grantInput.trim() }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setHasGrant(true); setGrantInput(''); setSyncMsg('Grant saved.');
    } catch (e: any) { setSyncMsg(e?.message || 'Save failed'); } finally { setBusy(false); }
  }

  async function syncCaptures() {
    setBusy(true); setSyncMsg('Syncing…');
    try {
      const res = await fetch('/api/service-jobs/sync', { method: 'POST' });
      const d = await res.json();
      const r = d.result || {};
      setSyncMsg(r.skipped ? `Nothing synced (${r.skipped}).` : `Synced: ${r.stored} new, ${r.acked} acked.`);
      if (sel) await selectJob(sel.id);
    } catch (e: any) { setSyncMsg(e?.message || 'Sync failed'); } finally { setBusy(false); }
  }

  async function selectJob(id: string) {
    setTokenInfo(null); setMsg('');
    const res = await fetch(`/api/service-jobs/${id}`);
    const data = await res.json();
    if (res.ok && data.job) {
      setSel(data.job);
      setDraft((data.job.line_items || []).map((li: any) => ({ description: li.description, amount: dollars(li.price_cents) })));
    }
  }

  async function createJob() {
    if (!form.title.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/service-jobs', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setForm({ title: '', customer_email: '', customer_name: '', vehicle_ref: '' });
      await loadJobs();
      if (data.job) await selectJob(data.job.id);
    } catch (e: any) { setMsg(e?.message || 'Create failed'); } finally { setBusy(false); }
  }

  async function saveItems() {
    if (!sel) return;
    setBusy(true); setMsg('');
    try {
      const items = draft.filter((d) => d.description.trim()).map((d) => ({ description: d.description.trim(), price_cents: Math.round((Number(d.amount) || 0) * 100) }));
      const res = await fetch(`/api/service-jobs/${sel.id}/line-items`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSel(data.job); setMsg('Saved — customer can now review.'); await loadJobs();
    } catch (e: any) { setMsg(e?.message || 'Save failed'); } finally { setBusy(false); }
  }

  async function mintToken() {
    if (!sel) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/service-jobs/${sel.id}/capture-token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mint failed');
      setTokenInfo({ capture_token: data.capture_token, expires_at: data.expires_at, qr_data_url: data.qr_data_url });
    } catch (e: any) { setMsg(e?.message || 'Mint failed'); } finally { setBusy(false); }
  }

  async function sendVoice() {
    if (!sel || !voiceText.trim()) return;
    setBusy(true); setVoiceMsg('');
    try {
      const res = await fetch(`/api/service-jobs/${sel.id}/voice-note`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: voiceText.trim() }) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.result?.skipped ? `Not sent (${d.result.skipped})` : d.result?.error || 'Send failed');
      setVoiceText(''); setVoiceMsg('Sent — plays in the tech’s ear.');
    } catch (e: any) { setVoiceMsg(e?.message || 'Send failed'); } finally { setBusy(false); }
  }

  if (auth === 'loading') return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  if (auth === 'disabled') return <p className="mt-6 text-sm text-muted-foreground">SecondSet isn&apos;t enabled in this environment.</p>;
  if (auth === 'unauth') return <p className="mt-6 text-sm">Please <a className="underline" href="/login">sign in</a> to manage service jobs.</p>;

  const portalUrl = sel ? `${typeof window !== 'undefined' ? window.location.origin : ''}/jobs/${sel.public_token}` : '';

  return (
    <div className="space-y-6">
    {/* Glasses capture grant + sync */}
    <div className="rounded-xl border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Glasses captures</span>
        {hasGrant ? (
          <>
            <span className="text-xs text-emerald-600">connected</span>
            <button type="button" disabled={busy} onClick={syncCaptures} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">Sync now</button>
          </>
        ) : (
          <>
            <input className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" placeholder="Paste the HJ capture grant token" value={grantInput} onChange={(e) => setGrantInput(e.target.value)} />
            <button type="button" disabled={busy || !grantInput.trim()} onClick={saveGrant} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">Connect</button>
          </>
        )}
      </div>
      {syncMsg ? <p className="mt-1 text-xs text-muted-foreground">{syncMsg}</p> : <p className="mt-1 text-xs text-muted-foreground">Pull the tech&apos;s photos + notes from the glasses into each job.</p>}
    </div>

    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      {/* Left: create + list */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">New job</div>
          <div className="mt-2 space-y-2">
            <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" placeholder="Title (e.g. 2018 Civic — brake inspection)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" placeholder="Vehicle / ref (optional)" value={form.vehicle_ref} onChange={(e) => setForm((f) => ({ ...f, vehicle_ref: e.target.value }))} />
            <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" placeholder="Customer email (optional)" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} />
            <button type="button" disabled={busy || !form.title.trim()} onClick={createJob} className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Create job</button>
          </div>
        </div>
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">Jobs</div>
          {jobs.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No jobs yet.</p> : (
            <ul className="divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button type="button" onClick={() => selectJob(j.id)} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${sel?.id === j.id ? 'bg-muted' : ''}`}>
                    <span className="truncate">{j.title || '(untitled)'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{j.status.replace('_', ' ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: selected job detail */}
      <div>
        {!sel ? <p className="text-sm text-muted-foreground">Select or create a job.</p> : (
          <div className="space-y-5">
            <div>
              <div className="text-lg font-semibold">{sel.title || '(untitled)'}</div>
              <div className="text-xs text-muted-foreground">Status: {sel.status.replace('_', ' ')}{sel.consent_captured_at ? ' · consent ✓' : ''}</div>
            </div>

            {/* Glasses capture token */}
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Tech&apos;s glasses token</div>
                <button type="button" disabled={busy} onClick={mintToken} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">Mint</button>
              </div>
              {tokenInfo ? (
                <div className="mt-2 flex gap-3">
                  {tokenInfo.qr_data_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tokenInfo.qr_data_url} alt="Scan to bind the glasses to this job" className="h-28 w-28 shrink-0 rounded-md border border-border bg-white" />
                  ) : null}
                  <div className="min-w-0 break-all rounded-md bg-muted/40 p-2 font-mono text-xs">{tokenInfo.capture_token}
                    <div className="mt-1 font-sans text-[11px] text-muted-foreground">Expires {new Date(tokenInfo.expires_at).toLocaleString()}. The tech scans the QR (or picks the job in the companion) to bind the glasses.</div>
                  </div>
                </div>
              ) : <p className="mt-1 text-xs text-muted-foreground">Mint a scoped token + QR for the tech to bind the glasses and attach photos + notes.</p>}
            </div>

            {/* Owner → tech voice note (plays in-ear; only reaches a tech bound to this job) */}
            <div className="rounded-xl border border-border p-3">
              <div className="text-sm font-semibold">Say something to the tech</div>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm" placeholder="e.g. check the rear rotor too" value={voiceText} onChange={(e) => setVoiceText(e.target.value)} />
                <button type="button" disabled={busy || !voiceText.trim()} onClick={sendVoice} className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50">Send</button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{voiceMsg || 'Plays in the tech’s ear — only if they’re currently bound to this job.'}</p>
            </div>

            {/* Line items editor */}
            <div className="rounded-xl border border-border p-3">
              <div className="text-sm font-semibold">Proposed work</div>
              <div className="mt-2 space-y-2">
                {draft.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm" placeholder="Description" value={d.description} onChange={(e) => setDraft((arr) => arr.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    <input className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm" placeholder="$" inputMode="decimal" value={d.amount} onChange={(e) => setDraft((arr) => arr.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                    <button type="button" onClick={() => setDraft((arr) => arr.filter((_, j) => j !== i))} className="rounded-md px-2 text-sm text-muted-foreground hover:bg-muted">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => setDraft((arr) => [...arr, { description: '', amount: '' }])} className="text-xs text-muted-foreground hover:underline">+ Add line</button>
              </div>
              <button type="button" disabled={busy} onClick={saveItems} className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save & send for approval</button>
            </div>

            {/* Captures + customer link */}
            <div className="rounded-xl border border-border p-3">
              <div className="text-sm font-semibold">Captured proof ({sel.captures.length})</div>
              {sel.captures.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">None yet — captures arrive from the glasses.</p> : (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {sel.captures.map((c) => <li key={c.id}>{c.kind === 'photo' ? '📷 photo' : `🎙️ ${c.transcript?.slice(0, 60) || 'note'}`}</li>)}
                </ul>
              )}
              {portalUrl ? (
                <div className="mt-3 text-xs">
                  <div className="text-muted-foreground">Customer link:</div>
                  <a href={portalUrl} target="_blank" rel="noreferrer" className="break-all font-mono text-primary underline">{portalUrl}</a>
                </div>
              ) : null}
            </div>

            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
