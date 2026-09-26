'use client';

// components/admin/guest-signup-box.tsx
//
// The ONE sign-up form a guest ever sees — inline in the banner, and as a modal that any surface
// can open by dispatching GUEST_SIGNUP_EVENT (the toolbar button, and Publish itself when the
// server answers `needs_signup`).
//
// Upgrades the anonymous user IN PLACE via supabase.auth.updateUser({ email, password }) — same
// uid, so the draft they own is theirs the moment they confirm. A fresh /login would mint a
// different uid and orphan the draft. The password means they can sign in on any device
// afterwards; the confirmation link brings them back to THIS editor, not the homepage.
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';
import { GUEST_SIGNUP_EVENT, editorPathFromPathname, guestSignupRedirectUrl, passwordProblem } from '@/lib/auth/guestSignup';
import { trackGuestFunnel, isGuestFunnelSurface, type GuestFunnelSurface } from '@/lib/analytics/guestFunnel';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'exists';

export function GuestSignupForm({
  onDone,
  autoFocus = true,
  compact = false,
  surface = 'modal',
}: {
  onDone?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
  /** Which surface this copy of the form is mounted in — recorded with every step it emits. */
  surface?: GuestFunnelSurface;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const editorPath = () => (typeof window === 'undefined' ? null : editorPathFromPathname(window.location.pathname));

  /** Existing account: hand the draft over via the claim cookie, then /login with the email prefilled. */
  const goLogin = async () => {
    const path = editorPath();
    const id = path?.split('/').pop();
    if (id) {
      try { await fetch(`/api/templates/${id}/claim-token`, { method: 'POST' }); } catch { /* best-effort */ }
    }
    const q = new URLSearchParams({ next: path ?? '/admin/templates/list' });
    if (email.trim()) q.set('email', email.trim());
    window.location.href = `/login?${q.toString()}`;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    // ⚠️ Emitted BEFORE the password check, so a builder who tries and is bounced by our own rule
    // still counts as having tried. Counting only the attempts that pass validation would hide the
    // most actionable failure there is — someone who wanted an account and our form said no.
    trackGuestFunnel('signup_submitted', { surface });
    const pwProblem = passwordProblem(password);
    if (pwProblem) {
      setStatus('error');
      setMessage(pwProblem);
      trackGuestFunnel('signup_failed', { surface, reason: 'weak_password' });
      return;
    }
    setStatus('sending');
    setMessage(null);
    try {
      const emailRedirectTo = guestSignupRedirectUrl(window.location.origin, editorPath());
      const { error } = await supabase.auth.updateUser({ email: addr, password }, { emailRedirectTo });
      if (error) {
        const already = (error as any)?.code === 'email_exists' || /already.*(registered|exists|in use)/i.test(error.message || '');
        if (already) {
          setStatus('exists');
          setMessage('You already have an account with this email.');
          trackGuestFunnel('signup_existing_account', { surface });
          return;
        }
        setStatus('error');
        setMessage(error.message || 'Could not start signup. Please try again.');
        // ⚠️ `reason: 'error'` and nothing else. Supabase puts the address into some of these
        // messages, and this row is analytics, not a log.
        trackGuestFunnel('signup_failed', { surface, reason: 'error' });
        return;
      }
      setStatus('sent');
      setMessage(`Check ${addr} to confirm — the link brings you straight back here, and Publish will be ready.`);
      // The last thing we can see from this side. GUEST_SIGNUP_CONFIRMED picks it up from the auth
      // callback if they come back — the gap between these two is the email deliverability story.
      trackGuestFunnel('signup_email_sent', { surface });
      onDone?.();
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Something went wrong. Please try again.');
      trackGuestFunnel('signup_failed', { surface, reason: 'error' });
    }
  };

  if (status === 'sent') return <p className="text-sm text-emerald-300" role="status">{message}</p>;

  return (
    <form onSubmit={submit} className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
      <input
        type="email"
        required
        autoFocus={autoFocus}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email"
        autoComplete="email"
        disabled={status === 'sending'}
        className={`${compact ? 'w-52' : 'w-full'} rounded-md border border-sky-500/40 bg-zinc-900/70 px-3 py-1.5 text-white placeholder:text-zinc-500 focus:border-sky-400 focus:outline-none`}
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Choose a password"
        aria-label="Password"
        autoComplete="new-password"
        minLength={8}
        disabled={status === 'sending'}
        className={`${compact ? 'w-44' : 'w-full'} rounded-md border border-sky-500/40 bg-zinc-900/70 px-3 py-1.5 text-white placeholder:text-zinc-500 focus:border-sky-400 focus:outline-none`}
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="rounded-md bg-sky-500 px-3 py-1.5 font-medium text-zinc-950 transition hover:bg-sky-400 disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending…' : 'Create my account'}
      </button>
      {!compact && <p className="text-xs text-zinc-400">Free. Your site stays exactly as it is — signing up just makes it yours to publish.</p>}
      {status === 'exists' && (
        <p className="w-full text-sm text-sky-200" role="status">
          {message}{' '}
          <button type="button" onClick={goLogin} className="font-medium text-sky-300 underline underline-offset-2 hover:text-sky-100">Log in instead →</button>
        </p>
      )}
      {status === 'error' && message && <p className="w-full text-sm text-red-300" role="alert">{message}</p>}
    </form>
  );
}

/**
 * Mounted once in the guest shell. Opens on GUEST_SIGNUP_EVENT — from the toolbar's button or from
 * Publish when the server says `needs_signup` — so the form appears at the moment of intent.
 */
export default function GuestSignupModal() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const why = (e as CustomEvent).detail?.reason ?? null;
      setReason(why);
      setOpen(true);
      // ⚠️ `publish` is the signal worth separating from the rest: it means they tried to publish
      // and were refused, which is intent, not curiosity. If that number is healthy and
      // `signup_submitted` is not, the form is the problem; if it is zero, nobody is getting far
      // enough to be refused and the problem is upstream of this component entirely.
      trackGuestFunnel('signup_opened', {
        surface: isGuestFunnelSurface(why) ? why : 'modal',
      });
    };
    window.addEventListener(GUEST_SIGNUP_EVENT, onOpen);
    return () => window.removeEventListener(GUEST_SIGNUP_EVENT, onOpen);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="guest-signup-title">
      <div className="w-full max-w-md rounded-xl border border-sky-500/30 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="guest-signup-title" className="text-base font-semibold text-white">Sign up to publish</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {reason === 'publish' ? 'Publishing needs an account so the site is yours. ' : ''}
              Your work is saved and stays with you.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded px-2 text-zinc-400 hover:text-white">×</button>
        </div>
        <div className="mt-4">
          <GuestSignupForm />
        </div>
      </div>
    </div>
  );
}
