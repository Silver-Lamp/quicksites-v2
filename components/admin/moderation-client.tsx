'use client';

// components/admin/moderation-client.tsx
//
// The moderation cockpit UI: pending comments (approve/reject) + reported-but-live
// comments (approve = dismiss the reports / reject = take down) across every site.
// Approve/reject ride the owner-gated /api/comments/moderate (a platform admin passes
// requireTemplateOwner on any template). Reads the queue from /api/admin/comments/queue.

import * as React from 'react';
import Link from 'next/link';

type Item = {
  id: string;
  template_id: string;
  slug: string;
  site: string;
  block_id: string;
  author_name: string;
  body: string;
  report_count: number | null;
  created_at: string;
};

function Row({ item, onAct, busy }: { item: Item; onAct: (i: Item, a: 'approve' | 'reject') => void; busy: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-neutral-100">{item.author_name}</span>
          {(item.report_count ?? 0) > 0 && (
            <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">⚠ reported {item.report_count}×</span>
          )}
          <span className="text-xs text-neutral-500">
            on{' '}
            <Link href={`/admin/templates/${item.template_id}`} className="text-sky-400 hover:underline">{item.site}</Link>
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onAct(item, 'approve')} disabled={busy}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">Approve</button>
          <button onClick={() => onAct(item, 'reject')} disabled={busy}
            className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50">Reject</button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{item.body}</p>
    </div>
  );
}

export default function ModerationClient() {
  const [pending, setPending] = React.useState<Item[]>([]);
  const [reported, setReported] = React.useState<Item[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/comments/queue', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `failed (${res.status})`);
      setPending(j.pending ?? []);
      setReported(j.reported ?? []);
    } catch (e: any) {
      setError(e?.message || 'failed');
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const act = async (item: Item, action: 'approve' | 'reject') => {
    setBusyId(item.id);
    try {
      const res = await fetch('/api/comments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: item.template_id, commentId: item.id, action }),
      });
      if (!res.ok) throw new Error();
      setPending((p) => p.filter((x) => x.id !== item.id));
      setReported((p) => p.filter((x) => x.id !== item.id));
    } catch {
      setError('Could not update that comment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Moderation</h1>
          <p className="mt-1 text-sm text-neutral-400">Comments awaiting approval or reported across every site.</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800">Refresh</button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Awaiting approval {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing pending. ✓</p>
        ) : (
          <div className="space-y-2">{pending.map((i) => <Row key={i.id} item={i} onAct={act} busy={busyId === i.id} />)}</div>
        )}
      </section>

      {reported.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Reported but still live <span className="ml-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">{reported.length}</span>
          </h2>
          <p className="mb-2 text-xs text-neutral-500">Approve to dismiss the reports, or reject to take it down.</p>
          <div className="space-y-2">{reported.map((i) => <Row key={i.id} item={i} onAct={act} busy={busyId === i.id} />)}</div>
        </section>
      )}
    </div>
  );
}
