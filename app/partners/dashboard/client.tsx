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

export function ConnectPayouts({ status }: { status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/partners/connect/onboard', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      window.location.href = json.url;
    } catch (e: any) {
      setError(e?.message || 'Failed');
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch('/api/partners/connect/status', { cache: 'no-store' });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'active') {
    return <div className="text-sm font-medium text-green-400">Payouts connected ✓ (Stripe)</div>;
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={connect}
          disabled={busy}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : status ? 'Finish connecting payouts' : 'Connect payouts'}
        </button>
        {status && (
          <button onClick={refresh} disabled={busy} className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
            Refresh
          </button>
        )}
      </div>
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
