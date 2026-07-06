'use client';

// Row actions for the outreach dashboard: copy the claim link, delete a dud draft.
import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function OutreachActions({ id, claimPath }: { id: string; claimPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      const url = claimPath.startsWith('http') ? claimPath : `${window.location.origin}${claimPath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const del = async () => {
    if (busy) return;
    if (!window.confirm('Delete this unclaimed draft? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/outreach/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || 'Delete failed.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <button
        onClick={copy}
        className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800"
      >
        {copied ? 'Copied ✓' : 'Copy claim link'}
      </button>
      <button
        onClick={del}
        disabled={busy}
        className="rounded-md border border-neutral-800 px-2 py-1 text-xs text-neutral-500 transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
      >
        {busy ? '…' : 'Delete'}
      </button>
    </div>
  );
}
