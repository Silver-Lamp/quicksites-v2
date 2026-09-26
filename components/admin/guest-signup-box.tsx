'use client';

// components/admin/guest-signup-box.tsx
//
// The ONE sign-up form a guest ever sees — inline in the banner, and as a modal that any surface
// can open by dispatching GUEST_SIGNUP_EVENT (the toolbar button, and Publish itself when the
// server answers `needs_signup`).
//
// Two ways up, and BOTH upgrade the anonymous user IN PLACE — same uid, so the draft they built
// stays theirs. A fresh /login would mint a different uid and orphan it.
//
//   • email + password → supabase.auth.updateUser({ email, password })
//   • Google           → supabase.auth.linkIdentity({ provider: 'google' })
//
// ⚠️ `linkIdentity`, NOT `signInWithOAuth`. The /login button can use signInWithOAuth because
// nobody there has anything to lose; here it would START A NEW SESSION under a new uid and orphan
// the site — the same failure as sending them to /login, wearing a nicer button. If you are
// tempted to share the /login helper, this is why you cannot.
//
// ⚠️ Google is added because 21 of 21 builders never typed an email (docs/GUEST_SIGNUP_PLAN.md).
// The password path asks for an address, an invented password, and a trip to an inbox before the
// site goes live. Every step emits its `method`, so whether one tap actually beats that is a
// question the funnel will answer instead of us assuming it.
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';
import { GUEST_SIGNUP_EVENT, editorPathFromPathname, guestSignupRedirectUrl, passwordProblem } from '@/lib/auth/guestSignup';
import { googleAuthEnabled } from '@/lib/flags/googleAuth';
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

  /**
   * ⚠️ `linkIdentity`, NOT `signInWithOAuth` — and this is the whole reason a guest cannot simply
   * reuse the /login button.
   *
   * `signInWithOAuth` STARTS A NEW SESSION. For an anonymous builder that mints a different uid,
   * and the draft they just spent an hour on belongs to the old one — orphaned, invisible, gone.
   * That is the exact failure this file's header already warns about for a fresh /login.
   * `linkIdentity` attaches the Google identity to the SAME uid, so the site stays theirs.
   *
   * ⚠️ It needs "Manual linking" enabled in Supabase as well as the Google provider. Both are
   * dashboard actions; until they are done `googleAuthEnabled()` keeps this button off the page
   * entirely, because a button that 400s is worse than no button.
   */
  const continueWithGoogle = async () => {
    if (status === 'sending') return;
    trackGuestFunnel('signup_submitted', { surface, method: 'google' });
    setStatus('sending');
    setMessage(null);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: guestSignupRedirectUrl(window.location.origin, editorPath()) },
      });
      if (error) throw error;
      // Success means the browser is navigating to Google; leave the button spinning.
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Could not start Google sign-in.');
      trackGuestFunnel('signup_failed', { surface, method: 'google', reason: 'error' });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    // ⚠️ Emitted BEFORE the password check, so a builder who tries and is bounced by our own rule
    // still counts as having tried. Counting only the attempts that pass validation would hide the
    // most actionable failure there is — someone who wanted an account and our form said no.
    trackGuestFunnel('signup_submitted', { surface, method: 'password' });
    const pwProblem = passwordProblem(password);
    if (pwProblem) {
      setStatus('error');
      setMessage(pwProblem);
      trackGuestFunnel('signup_failed', { surface, method: 'password', reason: 'weak_password' });
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
          trackGuestFunnel('signup_existing_account', { surface, method: 'password' });
          return;
        }
        setStatus('error');
        setMessage(error.message || 'Could not start signup. Please try again.');
        // ⚠️ `reason: 'error'` and nothing else. Supabase puts the address into some of these
        // messages, and this row is analytics, not a log.
        trackGuestFunnel('signup_failed', { surface, method: 'password', reason: 'error' });
        return;
      }
      setStatus('sent');
      setMessage(`Check ${addr} to confirm — the link brings you straight back here, and Publish will be ready.`);
      // The last thing we can see from this side. GUEST_SIGNUP_CONFIRMED picks it up from the auth
      // callback if they come back — the gap between these two is the email deliverability story.
      trackGuestFunnel('signup_email_sent', { surface, method: 'password' });
      onDone?.();
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Something went wrong. Please try again.');
      trackGuestFunnel('signup_failed', { surface, method: 'password', reason: 'error' });
    }
  };

  if (status === 'sent') return <p className="text-sm text-emerald-300" role="status">{message}</p>;

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-3'}>
      {/* ⚠️ FIRST, not last, and that ordering is the point of the change.
          The measured problem is not that people choose the wrong sign-up method — it is that
          across 21 builders NOT ONE ever typed an email. The password path asks for an address,
          an invented password, and a trip to an inbox before the site they just built can go
          live. This asks for one tap. Putting it below the form would leave the heavy ask as the
          default and test nothing.
          Renders only when the Supabase provider is actually configured — see googleAuth.ts. */}
      {googleAuthEnabled() && (
        <>
          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={status === 'sending'}
            className={`${compact ? '' : 'w-full'} inline-flex items-center justify-center gap-2 rounded-md border border-zinc-600 bg-white px-3 py-1.5 font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60`}
          >
            <svg aria-hidden viewBox="0 0 48 48" className="h-4 w-4">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 13.7 17.6 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4.1 7-10.1 7-17.3z" />
              <path fill="#FBBC05" d="M10.4 28.2a14.5 14.5 0 0 1 0-8.4l-7.8-6.1a24 24 0 0 0 0 20.6l7.8-6.1z" />
              <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.8 2.2-6.4 0-11.7-4.2-13.6-10.1l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
            </svg>
            Continue with Google
          </button>
          {!compact && (
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              or use email
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
          )}
        </>
      )}
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
    </div>
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
