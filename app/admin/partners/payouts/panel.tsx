'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const usd = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

export default function PayoutsPanel() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<any>(null);

  const call = async (path: string, body?: any) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
    return json;
  };

  const approve = async () => {
    setBusy('approve'); setError(null); setMsg(null);
    try {
      const r = await call('/api/admin/partners/payouts/approve');
      setMsg(`Approved ${r.approved} commission(s) past the refund window.`);
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const doPreview = async () => {
    setBusy('preview'); setError(null); setMsg(null);
    try { setPreview(await call('/api/admin/partners/payouts/run', { dryRun: true })); }
    catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const run = async () => {
    if (!confirm('Run payouts now? This disburses all approved commissions.')) return;
    setBusy('run'); setError(null); setMsg(null);
    try {
      const r = await call('/api/admin/partners/payouts/run', { dryRun: false });
      setMsg(`Paid ${usd(r.totalCents)} to ${r.partners.length} partner(s).`);
      setPreview(null);
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-neutral-800 p-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={approve} disabled={!!busy} className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50">
          {busy === 'approve' ? 'Approving…' : 'Approve eligible'}
        </button>
        <button onClick={doPreview} disabled={!!busy} className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50">
          {busy === 'preview' ? 'Previewing…' : 'Preview payout'}
        </button>
        <button onClick={run} disabled={!!busy} className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-sky-400 disabled:opacity-50">
          {busy === 'run' ? 'Running…' : 'Run payout'}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-green-400">{msg}</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {preview && (
        <div className="mt-4 text-sm">
          <div className="text-neutral-400">
            Preview — {usd(preview.totalCents)} to {preview.partners.length} partner(s):
          </div>
          <ul className="mt-2 divide-y divide-neutral-800">
            {preview.partners.map((p: any, i: number) => (
              <li key={i} className="flex justify-between py-1">
                <span className="font-mono text-xs text-neutral-400">
                  {String(p.affiliateUserId).slice(0, 8)}… ({p.codes.join(', ')})
                </span>
                <span>{usd(p.amountCents)}</span>
              </li>
            ))}
            {preview.partners.length === 0 && <li className="py-2 text-neutral-500">Nothing approved to pay yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
