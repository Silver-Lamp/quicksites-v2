'use client';
// components/admin/ppl-sync-status-callbacks.tsx
//
// One click: point every tracking number's parent-call status callback at ours, so a caller who
// hangs up before the bridge is recorded as `abandoned` instead of sitting at `ringing` forever.
// Numbers bought or attached after 2026-10-05 get it automatically; this backfills the rest.
import { useState } from 'react';

type Result = { domain: string | null; number: string | null; ok: boolean; changed?: boolean; error?: string };

export default function PplSyncStatusCallbacks() {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [rows, setRows] = useState<Result[]>([]);

  const run = async () => {
    setBusy(true);
    setSummary(null);
    try {
      const r = await fetch('/api/admin/prospects/geo-campaign/sync-status-callbacks', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSummary(`Failed: ${j?.error ?? r.status}`);
        return;
      }
      setRows(j.results ?? []);
      setSummary(`${j.total} numbers checked · ${j.changed} updated · ${j.failed} failed`);
    } catch (e) {
      setSummary(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">Record hang-ups before the bridge</div>
          <p className="mt-1 max-w-xl text-xs text-zinc-400">
            Sets each tracking number&apos;s call-ended callback so a caller who hangs up during the
            announcement or the ring is logged as <span className="font-mono">abandoned</span> with its
            duration, instead of staying <span className="font-mono">ringing</span> forever. Safe to re-run.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-500/20 disabled:opacity-60"
        >
          {busy ? 'Updating…' : 'Sync status callbacks'}
        </button>
      </div>
      {summary && <p className="mt-3 text-xs text-zinc-300">{summary}</p>}
      {rows.some((r) => !r.ok) && (
        <ul className="mt-2 space-y-1 text-xs text-rose-300">
          {rows.filter((r) => !r.ok).map((r) => (
            <li key={`${r.domain}-${r.number}`}>{r.domain ?? '—'} · {r.number ?? '—'}: {r.error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
