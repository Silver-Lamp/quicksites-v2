'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export function JoinButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/partners/join', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to join');
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed');
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={join}
        disabled={busy}
        className="rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Setting up…' : 'Become a partner'}
      </button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-800">{link}</code>
      <button onClick={copy} className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}
