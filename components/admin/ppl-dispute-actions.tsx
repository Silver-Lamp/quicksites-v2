'use client';
// components/admin/ppl-dispute-actions.tsx — approve / deny one dispute from /admin/ppl.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PplDisputeActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function decide(decision: 'approved' | 'denied') {
    const note =
      window.prompt(
        `${decision === 'approved' ? 'Approve' : 'Deny'} — optional note to the business:`
      ) ?? undefined;
    if (note === undefined && decision === 'denied' && !window.confirm('Deny without a note?'))
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/ppl/disputes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={() => decide('approved')}
        disabled={busy}
        className="rounded border border-emerald-500/40 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        Approve + credit
      </button>
      <button
        onClick={() => decide('denied')}
        disabled={busy}
        className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
      >
        Deny
      </button>
      {msg ? <span className="text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
