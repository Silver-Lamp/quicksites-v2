'use client';

// Self-contained email proof-of-control UI for the DOMAIN claim flow
// (app/api/claim-site + the /api/claim/verify/email/{send,confirm} routes,
// gated by DOMAIN_CLAIM_VERIFICATION_ENABLED). Three steps in one component:
//   1. enter email        -> POST /api/claim/verify/email/send
//   2. enter 6-digit code -> POST /api/claim/verify/email/confirm (sets grant cookie)
//   3. complete the claim -> POST /api/claim-site (reads grant + verified row)
// No committed page/route — mount it wherever a domains-claim entry point is needed.
// See docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md.
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ERRORS: Record<string, string> = {
  rate_limited: 'Too many attempts. Please wait a bit and try again.',
  too_many: 'Too many tries on that code. Request a new one.',
  bad_code: "That code didn't match. Check it and try again.",
  expired: 'That code expired. Send a new one.',
  send_failed: "We couldn't send the email. Try again in a moment.",
  invalid_email: 'Please enter a valid email address.',
  missing_slug: 'Something went wrong identifying this site.',
  not_found: 'We couldn’t find that site.',
  already_claimed: 'This site has already been claimed.',
  not_enabled: 'Claiming is temporarily unavailable — please contact support.',
  not_verified: 'We couldn’t confirm your verification. Please try again.',
  server_error: 'Something went wrong on our end. Try again.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = 'email' | 'code' | 'done';

export default function DomainClaimVerify({
  slug,
  initialEmail = '',
  onClaimed,
}: {
  slug: string;
  initialEmail?: string;
  onClaimed?: () => void;
}) {
  const [stage, setStage] = React.useState<Stage>('email');
  const [email, setEmail] = React.useState(initialEmail);
  const [code, setCode] = React.useState('');
  const [masked, setMasked] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const msg = (k?: string) => (k && ERRORS[k]) || 'Something went wrong. Try again.';

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const sendCode = async () => {
    if (busy || !EMAIL_RE.test(email)) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const res = await post('/api/claim/verify/email/send', { slug, email });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(msg(j?.error)); return; }
      setMasked(j?.masked || email);
      setStage('code');
      setInfo(`We sent a 6-digit code to ${j?.masked || email}.`);
    } catch { setError('Network error. Try again.'); }
    finally { setBusy(false); }
  };

  const confirmAndClaim = async () => {
    if (busy || code.replace(/\D/g, '').length !== 6) return;
    setBusy(true); setError(null);
    try {
      const conf = await post('/api/claim/verify/email/confirm', { slug, email, code });
      const cj = await conf.json().catch(() => ({}));
      if (!conf.ok) { setError(msg(cj?.error)); return; }

      // Grant cookie is set — complete the claim.
      const claim = await post('/api/claim-site', { slug, email });
      const kj = await claim.json().catch(() => ({}));
      if (!claim.ok) { setError(msg(kj?.error)); return; }

      setStage('done');
      setInfo(null);
      onClaimed?.();
    } catch { setError('Network error. Try again.'); }
    finally { setBusy(false); }
  };

  if (stage === 'done') {
    return (
      <div className="mx-auto w-full max-w-sm text-center">
        <h2 className="text-lg font-semibold">You’re verified 🎉</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>{slug}</strong> is now claimed with <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      {stage === 'email' ? (
        <>
          <label className="text-sm font-medium">Email address</label>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@business.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendCode(); }}
          />
          <p className="text-xs text-muted-foreground">
            We’ll email a code to confirm you control this address.
          </p>
          <Button onClick={sendCode} disabled={busy || !EMAIL_RE.test(email)} className="w-full">
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
        </>
      ) : (
        <>
          <label className="text-sm font-medium">Enter the 6-digit code</label>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmAndClaim(); }}
            placeholder="123456"
            className="text-center text-2xl tracking-[0.4em]"
          />
          <Button
            onClick={confirmAndClaim}
            disabled={busy || code.replace(/\D/g, '').length !== 6}
            className="w-full"
          >
            {busy ? 'Verifying…' : 'Verify & claim'}
          </Button>
          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
          >
            Resend code
          </button>
        </>
      )}
      {info && <p className="text-sm text-emerald-500">{info}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
