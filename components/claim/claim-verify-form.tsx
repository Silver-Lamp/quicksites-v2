'use client';

// Two-step OTP UI for claim verification: send a code to the listing phone, then enter
// it. On success the server has set the grant + pending-claim cookies, so we just follow
// the returned `next` (→ sign up / log in → ownership transfers). See the /api/claim/verify routes.
import * as React from 'react';

const ERRORS: Record<string, string> = {
  rate_limited: 'Too many attempts. Please wait a bit and try again.',
  too_many: 'Too many tries on that code. Request a new one.',
  bad_code: "That code didn't match. Check it and try again.",
  expired: 'That code expired. Send a new one.',
  send_failed: "We couldn't send the text. Try again in a moment.",
  sms_not_configured: 'Texting is temporarily unavailable — please contact us to verify.',
  invalid_token: 'This link is no longer valid.',
  not_claimable: 'This site has already been claimed.',
};

export default function ClaimVerifyForm({ id, token, masked }: { id: string; token: string; masked: string }) {
  const [stage, setStage] = React.useState<'idle' | 'sent'>('idle');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const msg = (k: string) => ERRORS[k] || 'Something went wrong. Try again.';

  const send = async () => {
    if (busy) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const res = await fetch('/api/claim/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(msg(j?.error)); return; }
      setStage('sent');
      setInfo(`Code sent to ${j?.masked || masked}.`);
    } catch { setError('Network error. Try again.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (busy || code.replace(/\D/g, '').length !== 6) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/claim/verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token, code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(msg(j?.error)); return; }
      window.location.href = j?.next || '/login';
    } catch { setError('Network error. Try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-8 w-full">
      {stage === 'idle' ? (
        <button
          onClick={send}
          disabled={busy}
          className="w-full rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Text me the code'}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
            placeholder="6-digit code"
            className="w-full rounded-2xl border border-zinc-700 bg-transparent px-4 py-3 text-center text-2xl tracking-[0.4em] text-zinc-100 outline-none focus:border-emerald-500"
          />
          <button
            onClick={confirm}
            disabled={busy || code.replace(/\D/g, '').length !== 6}
            className="w-full rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify & claim →'}
          </button>
          <button onClick={send} disabled={busy} className="text-sm text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
            Resend code
          </button>
        </div>
      )}
      {info && <p className="mt-3 text-sm text-emerald-400">{info}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
