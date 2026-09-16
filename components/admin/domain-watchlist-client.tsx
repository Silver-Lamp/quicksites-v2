'use client';

// components/admin/domain-watchlist-client.tsx
//
// The domain watchlist (lib/domains/watchlist.ts) as a page: what we are waiting to buy, at what
// cap, what the last check said, and the three actions — add a name, run the check now, stop
// watching. Talks to /api/admin/domains/watchlist; the cron does the same work every 6h.
//
// Dark app chrome: semantic tokens + alpha tints only (CLAUDE.md §7).

import * as React from 'react';
import { Eye, Play, Plus, Loader2, RefreshCw, StopCircle, RotateCcw, ExternalLink } from 'lucide-react';

type Entry = {
  domain: string;
  max_price_usd: number;
  note?: string;
  added_at: string;
  status: 'watching' | 'bought' | 'stopped';
  last_checked_at?: string;
  last_result?: string;
  registry_status?: string[];
  bought_at?: string;
  price_usd?: number | null;
};

type RunReport = { checked: number; bought: string[]; overCap: string[]; unknown: string[]; taken: string[]; failed: string[] };

const STATUS: Record<Entry['status'], { label: string; cls: string }> = {
  watching: { label: 'Watching', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  bought: { label: 'Bought', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  stopped: { label: 'Stopped', cls: 'text-muted-foreground bg-muted border-border' },
};

function ago(iso?: string): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DomainWatchlistClient({ initial, registerEnabled }: { initial: Entry[]; registerEnabled: boolean }) {
  const [entries, setEntries] = React.useState<Entry[]>(initial);
  const [domain, setDomain] = React.useState('');
  const [cap, setCap] = React.useState('20');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [report, setReport] = React.useState<RunReport | null>(null);

  const api = async (method: string, body?: unknown, query = '') => {
    const res = await fetch(`/api/admin/domains/watchlist${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `${res.status}`);
    return json;
  };

  const refresh = async () => {
    const j = await api('GET');
    setEntries(j.entries ?? []);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy('add');
    try {
      const j = await api('POST', { domain, maxPriceUsd: Number(cap), note });
      setMsg({ kind: 'ok', text: `Watching ${j.entry.domain} at a $${j.entry.max_price_usd} cap.` });
      setDomain('');
      setNote('');
      await refresh();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message || 'Could not add.' });
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    setMsg(null);
    setBusy('run');
    try {
      const j = await api('POST', undefined, '?run=1');
      setReport(j);
      setEntries(j.entries ?? entries);
      const bought = j.bought?.length ? ` Bought: ${j.bought.join(', ')}.` : '';
      setMsg({ kind: 'ok', text: `Checked ${j.checked} name${j.checked === 1 ? '' : 's'}.${bought}` });
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message || 'Run failed.' });
    } finally {
      setBusy(null);
    }
  };

  const stop = async (d: string) => {
    if (!window.confirm(`Stop watching ${d}?`)) return;
    setBusy(d);
    try {
      await api('DELETE', { domain: d });
      await refresh();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message || 'Could not stop.' });
    } finally {
      setBusy(null);
    }
  };

  const rewatch = async (e: Entry) => {
    setBusy(e.domain);
    try {
      await api('POST', { domain: e.domain, maxPriceUsd: e.max_price_usd, note: e.note });
      await refresh();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message || 'Could not re-watch.' });
    } finally {
      setBusy(null);
    }
  };

  const watching = entries.filter((e) => e.status === 'watching').length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Eye className="h-6 w-6 text-sky-300" /> Domain watchlist
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Names we want at registration price the moment they become registerable. The cron checks
            every 6 hours and buys at or under each cap; anything else files a task and emails you.
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
        >
          {busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Check now
        </button>
      </div>

      {!registerEnabled && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <strong>VERCEL_DOMAIN_REGISTER_ENABLED is off in this environment.</strong> The check still runs, but an
          available name files a task for you to buy by hand instead of buying it.
        </div>
      )}

      {msg && (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            msg.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {report && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {(['bought', 'overCap', 'taken', 'unknown', 'failed'] as const).map((k) => (
            <span key={k} className="rounded-full border border-border bg-muted px-2.5 py-1">
              {k === 'overCap' ? 'over cap' : k}: {report[k].length}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={add} className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground sm:grid-cols-[1fr_120px_2fr_auto]">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Domain</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="richlandtowing.com"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Cap (USD/yr)</span>
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            type="number"
            min={1}
            max={500}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Note (why, and what it should serve once bought)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Unhyphenated twin of richland-towing.com — redirect to www"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="inline-flex items-center gap-2 self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Watch
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {entries.length} name{entries.length === 1 ? '' : 's'} · {watching} watching
        </span>
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Cap</th>
              <th className="px-3 py-2">Last check</th>
              <th className="px-3 py-2">Registry</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nothing watched yet. Add a name above.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.domain} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <a href={`https://${e.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                    {e.domain} <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                  {e.note && <div className="mt-1 max-w-md text-xs text-muted-foreground">{e.note}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span>
                  {e.status === 'bought' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      ${e.price_usd ?? '?'} · {ago(e.bought_at)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">${e.max_price_usd}</td>
                <td className="px-3 py-2 text-muted-foreground" title={e.last_checked_at}>
                  {ago(e.last_checked_at)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {e.registry_status === undefined ? '—' : e.registry_status.length === 0 ? 'no record (dropped)' : e.registry_status.join(', ')}
                </td>
                <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">{e.last_result ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  {e.status === 'watching' ? (
                    <button
                      type="button"
                      onClick={() => void stop(e.domain)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {busy === e.domain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />} Stop
                    </button>
                  ) : e.status === 'stopped' ? (
                    <button
                      type="button"
                      onClick={() => void rewatch(e)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Watch again
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Cron: <code>/api/cron/domain-watch</code> (every 6h, tracked on <a href="/admin/cron" className="underline">Cron Health</a>). Money moves only at or
        under a cap you typed here; premium re-lists are refused. A drop-catcher can still beat a 6-hour check — for a name you
        must have, place a backorder too.
      </p>
    </div>
  );
}
