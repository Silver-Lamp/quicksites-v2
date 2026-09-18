'use client';
// components/admin/ppl-account-actions.tsx — the two buttons an operator needs per account:
// a fresh deposit link (copied to the clipboard) and pause/resume. Calls the admin API; the
// page re-renders on refresh so the row reflects the table, never local state.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PplAccountActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function depositLink() {
    setBusy('link');
    setMsg(null);
    try {
      const amount = window.prompt('Deposit amount in dollars', '500');
      if (!amount) return;
      const cents = Math.round(parseFloat(amount) * 100);
      const r = await fetch(`/api/admin/ppl/accounts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deposit_link', deposit_cents: cents }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      await navigator.clipboard.writeText(j.checkout_url);
      setMsg('link copied');
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  }

  async function toggle() {
    const next = status === 'paused' ? 'active' : 'paused';
    if (!window.confirm(`${next === 'paused' ? 'Pause' : 'Resume'} this account?`)) return;
    setBusy('toggle');
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/ppl/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={depositLink}
        disabled={!!busy}
        className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
      >
        {busy === 'link' ? '…' : 'Deposit link'}
      </button>
      {status !== 'closed' ? (
        <button
          onClick={toggle}
          disabled={!!busy}
          className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
        >
          {status === 'paused' ? 'Resume' : 'Pause'}
        </button>
      ) : null}
      {msg ? <span className="text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
