'use client';

// Trigger the signed-agreement notices from the ledger.
//
// ⚠️ IT SHOWS THE PROVIDER'S ERROR VERBATIM ON FAILURE. The audience is an operator deciding what
// to do next, and this button's first real failure was "API key is invalid" — actionable in a way
// that "couldn't send" is not. Replacing that with a friendly message would recreate, in the UI,
// the exact `[object Object]` problem that made the first failure take a probe to diagnose.
//
// ⚠️ AND IT EMAILS A REAL THIRD PARTY, so it says so before it does it. A one-click action that
// contacts someone outside the company should not be indistinguishable from a refresh.
import * as React from 'react';

export default function NotifyButton({
  agreementId,
  label,
}: {
  agreementId: string;
  label: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    if (busy) return;
    if (!confirm('This emails both parties, including the signer. Send now?')) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/agreements/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId }),
      });
      const json = await res.json().catch(() => ({}));
      setResult(
        res.ok && json?.ok
          ? { ok: true, msg: 'Sent — reload to see the timestamp.' }
          : { ok: false, msg: json?.error ?? `Failed (HTTP ${res.status})` },
      );
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-sky-500/40 disabled:opacity-40"
      >
        {busy ? 'Sending…' : label}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.msg}
        </span>
      )}
    </div>
  );
}
