'use client';
// components/admin/gsc-inspect-run.tsx — run the URL Inspection sweep now (admin session; the cron
// route accepts either the cron secret or an admin). `force` re-inspects URLs seen this week.
import { useState } from 'react';

export default function GscInspectRun() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (force: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cron/gsc-url-inspect${force ? '?force=1' : ''}`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`Failed: ${j?.error ?? r.status}`); return; }
      setMsg(`${j.inspected ?? 0} inspected · ${j.remaining ?? 0} left for next run · ${(j.newTasks ?? []).length} new task(s)${j.failed?.length ? ` · ${j.failed.length} failed` : ''}`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" onClick={() => run(false)} disabled={busy} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-500/20 disabled:opacity-60">
          {busy ? 'Inspecting…' : 'Run sweep now'}
        </button>
        <button type="button" onClick={() => run(true)} disabled={busy} title="Re-inspect URLs already checked this week" className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60">
          Force re-check
        </button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
