'use client';

// components/admin/alert-channel-test.tsx
//
// "Send a test alert" — the button that turns a green config gate into an observed fact.
//
// ⚠️ It reports what actually happened rather than a checkmark. `accepted` means Resend took the
// message, which is NOT delivery; `dev_noop` means `sendEmail` returned success without sending,
// which is the exact failure this exists to catch. A button that said "Sent ✓" for all three
// would be the most convincing liar in the system.
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Result = {
  ok: boolean;
  delivery: 'accepted' | 'dev_noop' | 'failed' | 'no_recipients';
  caveat?: string;
  detail?: string;
  recipients?: string[];
  providerId?: string | null;
  sentryCaptured?: boolean;
  error?: string | null;
};

export default function AlertChannelTest() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function send() {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch('/api/admin/alerts/test', { method: 'POST' });
      setRes((await r.json()) as Result);
    } catch (e: any) {
      setRes({ ok: false, delivery: 'failed', error: e?.message || 'request failed' });
    } finally {
      setBusy(false);
    }
  }

  const tone =
    res?.delivery === 'accepted'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
      : res?.delivery === 'dev_noop'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
        : 'border-red-500/40 bg-red-500/10 text-red-200';

  return (
    <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">Alert channel</h2>
          <p className="mt-1 max-w-2xl text-xs text-neutral-400">
            Sends a real email down the same path an outage alert uses —{' '}
            <code className="rounded bg-neutral-800 px-1">sendEmail</code> → Resend → ADMIN_EMAILS.
            A green gate on <code className="rounded bg-neutral-800 px-1">/status</code> only means
            the address is set; this is the only way to know an alert would reach you.
          </p>
        </div>
        <Button variant="outline" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send a test alert'}
        </Button>
      </div>

      {res && (
        <div className={`mt-3 rounded-md border p-3 text-xs ${tone}`}>
          <div className="font-medium">
            {res.delivery === 'accepted'
              ? 'Accepted by Resend'
              : res.delivery === 'dev_noop'
                ? 'NOT SENT — no RESEND_API_KEY'
                : res.delivery === 'no_recipients'
                  ? 'No recipients'
                  : 'Failed'}
          </div>
          <p className="mt-1">{res.caveat ?? res.detail ?? res.error}</p>
          {res.recipients?.length ? (
            <p className="mt-1 opacity-80">To: {res.recipients.join(', ')}</p>
          ) : null}
          {res.providerId ? <p className="mt-1 opacity-60">Resend id: {res.providerId}</p> : null}
          <p className="mt-1 opacity-60">
            Sentry: {res.sentryCaptured ? 'captured' : 'not captured'}
          </p>
        </div>
      )}
    </div>
  );
}
