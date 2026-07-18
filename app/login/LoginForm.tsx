// app/login/LoginForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { googleAuthEnabled } from '@/lib/flags/googleAuth';
import { finalizeBrowserSession } from '@/lib/auth/browserSession';

type BuildInfo = { sha?: string; env?: string; deployId?: string };

type OrgBranding = {
  name?: string | null;
  logo_url?: string | null;       // light/default logo
  logo_dark_url?: string | null;  // dark-mode logo (optional)
};

type AuthMode = 'password' | 'magic';

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginForm({ build }: { build?: BuildInfo }) {
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = sp.get('next') || sp.get('redirectTo') || '/admin/templates/list';
    return n.startsWith('/') ? n : '/admin/templates/list';
  }, [sp]);

  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const showGoogle = googleAuthEnabled();

  // Referral code: prefilled from ?ref=, or shown behind a toggle. On send, we validate it +
  // set the qs_ref cookie so attribution flows when they later create a store.
  const [refCode, setRefCode] = useState('');
  const [showRef, setShowRef] = useState(false);
  const [refNote, setRefNote] = useState<string | null>(null);

  // Browser Supabase client (inherits user session from local storage). We pin the implicit
  // flow so OAuth returns tokens in the URL fragment — the same path /auth/callback already
  // finalizes for magic links (no server-side PKCE code-verifier needed).
  const sb = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true } }
      ),
    []
  );

  // Try to load org branding (logo/name) from multiple sources
  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      // 1) Env override (easy per-deploy branding)
      const envLogo = process.env.NEXT_PUBLIC_LOGIN_LOGO_URL || null;
      const envLogoDark = process.env.NEXT_PUBLIC_LOGIN_LOGO_DARK_URL || null;
      const envName = process.env.NEXT_PUBLIC_ORG_NAME || null;
      if (envLogo || envLogoDark || envName) {
        if (!cancelled) {
          setBranding({ name: envName, logo_url: envLogo, logo_dark_url: envLogoDark });
        }
        return;
      }

      // 2) Optional server route (if your app exposes it)
      try {
        const r = await fetch('/api/org/branding', { method: 'GET' });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) {
            setBranding({
              name: j?.name ?? null,
              logo_url: j?.logo_url ?? j?.logo ?? null,
              logo_dark_url: j?.logo_dark_url ?? j?.logo_dark ?? null,
            });
          }
          return;
        }
      } catch {
        /* ignore */
      }

      // 3) Fallback: Supabase lookup by slug (from subdomain or localStorage)
      try {
        const host = window.location.hostname.toLowerCase();
        const sub = host.split('.')[0];
        const subIsGeneric = ['www', 'app', 'admin', 'login'].includes(sub);
        const slug =
          (typeof localStorage !== 'undefined' && localStorage.getItem('org_slug')) ||
          (!subIsGeneric ? sub : null);

        if (slug) {
          // Try public.orgs first
          let { data: orgRow } = await sb
            .from('orgs')
            .select('name, logo_url, logo_dark_url')
            .eq('slug', slug)
            .single();

          // Try public.organizations as a fallback if your schema uses that
          if (!orgRow) {
            const alt = await sb
              .from('organizations')
              .select('name, logo_url, logo_dark_url')
              .eq('slug', slug)
              .single();
            orgRow = alt.data ?? null;
          }

          if (orgRow && !cancelled) {
            setBranding({
              name: orgRow.name ?? null,
              logo_url: orgRow.logo_url ?? null,
              logo_dark_url: orgRow.logo_dark_url ?? null,
            });
          }
        }
      } catch {
        /* ignore */
      }
    }

    loadBranding();
    return () => {
      cancelled = true;
    };
  }, [sb]);

  // Prefill the email from ?email= (e.g. the guest banner sends users here when
  // their address already has an account), falling back to a dev convenience value.
  useEffect(() => {
    const fromParam = sp.get('email');
    if (fromParam && /@/.test(fromParam)) {
      setEmail(fromParam);
    } else if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@pointsevenstudio.com');
    }
  }, [sp]);

  // Prefill the referral code from ?ref= (or an existing qs_ref cookie) and reveal the field.
  useEffect(() => {
    const fromParam = sp.get('ref');
    const fromCookie = typeof document !== 'undefined'
      ? document.cookie.split('; ').find((c) => c.startsWith('qs_ref='))?.split('=')[1]
      : undefined;
    const code = (fromParam || (fromCookie ? decodeURIComponent(fromCookie) : '') || '').trim();
    if (code) {
      setRefCode(code);
      setShowRef(true);
    }
  }, [sp]);

  /** Validate the referral code + set the qs_ref cookie. Best-effort — never blocks sign-in. */
  const applyRefCode = async (): Promise<void> => {
    const code = refCode.trim();
    if (!code) return;
    try {
      const r = await fetch('/api/referrals/apply-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (r.ok) setRefNote(`✓ Referral code “${code}” applied.`);
      else setRefNote('That referral code isn’t recognized — you can still sign in.');
    } catch {
      /* ignore — attribution is best-effort */
    }
  };

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  /** After a client-side session (password / signup), set server cookies then navigate. */
  const finalizeAndGo = async () => {
    const r = await finalizeBrowserSession(sb);
    if (!r.ok) {
      setStatus(`❌ ${r.error === 'no_session' ? 'Could not start your session. Try again.' : r.error}`);
      return false;
    }
    window.location.assign(r.redirect || nextPath);
    return true;
  };

  // ── Google OAuth (implicit → fragment → /auth/callback finalizes) ──
  const signInWithGoogle = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus('Redirecting to Google…');
    try {
      if (refCode.trim()) await applyRefCode(); // set qs_ref before we leave the page
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo(), queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      // On success the browser is navigating away; nothing else to do.
    } catch (err: any) {
      setStatus(`❌ ${err?.message || 'Could not start Google sign-in.'}`);
      setIsLoading(false);
    }
  };

  // ── Email + password: sign in ──
  const signInPassword = async () => {
    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) return setStatus('❌ Please enter a valid email.');
    if (!password) return setStatus('❌ Enter your password.');
    setIsLoading(true);
    setStatus('Signing in…');
    try {
      const { error } = await sb.auth.signInWithPassword({ email: emailNorm, password });
      if (error) {
        setStatus('❌ Wrong email or password. Try again, reset your password, or use a magic link.');
        return;
      }
      await finalizeAndGo();
    } catch (err: any) {
      setStatus(`❌ ${err?.message || 'Network error. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email + password: create account ──
  const createAccount = async () => {
    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) return setStatus('❌ Please enter a valid email.');
    if (password.length < 8) return setStatus('❌ Use a password of at least 8 characters.');
    setIsLoading(true);
    setStatus('Creating your account…');
    try {
      if (refCode.trim()) await applyRefCode(); // attribution before signup
      const { data, error } = await sb.auth.signUp({
        email: emailNorm,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) {
        setStatus(`❌ ${/already registered/i.test(error.message) ? 'That email already has an account — sign in or reset your password.' : error.message}`);
        return;
      }
      if (data.session) {
        // Email confirmation is OFF in this project → we already have a session.
        await finalizeAndGo();
      } else {
        // Confirmation ON (or the address already exists) → verify by email.
        setStatus('✅ Check your email to confirm your account, then sign in.');
      }
    } catch (err: any) {
      setStatus(`❌ ${err?.message || 'Network error. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Forgot password → email a reset link ──
  const forgotPassword = async () => {
    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) return setStatus('❌ Enter your email first, then tap “Forgot password”.');
    setIsLoading(true);
    setStatus('Sending a reset link…');
    try {
      const { error } = await sb.auth.resetPasswordForEmail(emailNorm, {
        redirectTo: `${window.location.origin}/auth/reset?next=${encodeURIComponent(nextPath)}`,
      });
      if (error) throw error;
      setStatus('✅ If that email has an account, a password-reset link is on its way.');
    } catch (err: any) {
      setStatus(`❌ ${err?.message || 'Could not send a reset link.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Magic link (unchanged behavior: dev sends client-side, prod via /api/login) ──
  const sendMagicLink = async () => {
    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) return setStatus('❌ Please enter a valid email.');
    setIsLoading(true);
    setStatus('Sending magic link…');
    if (refCode.trim()) await applyRefCode();
    try {
      const rt = redirectTo();
      if (process.env.NODE_ENV !== 'production') {
        const { error } = await sb.auth.signInWithOtp({
          email: emailNorm,
          options: { emailRedirectTo: rt, shouldCreateUser: true },
        });
        if (error) throw error;
        setStatus('✅ Check your email for the magic link.');
        return;
      }
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNorm, next: nextPath }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        const { error } = await sb.auth.signInWithOtp({
          email: emailNorm,
          options: { emailRedirectTo: rt, shouldCreateUser: true },
        });
        if (error) throw error;
      }
      setStatus('✅ Check your email for the magic link.');
    } catch (err: any) {
      setStatus(`❌ ${err?.message || 'Network error. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    if (mode === 'magic') return void sendMagicLink();
    return void signInPassword();
  };

  const showDebug = process.env.NODE_ENV !== 'production';
  const inputCls =
    'w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md">
        {/* Org logo (dark/light aware if both provided) */}
        {(branding?.logo_url || branding?.logo_dark_url || branding?.name) && (
          <div className="flex flex-col items-center mb-6">
            {branding?.logo_dark_url ? (
              <>
                <img src={branding.logo_url || branding.logo_dark_url} alt={branding?.name || 'Organization logo'} className="block dark:hidden h-10 w-auto" />
                <img src={branding.logo_dark_url} alt={branding?.name || 'Organization logo'} className="hidden dark:block h-10 w-auto" />
              </>
            ) : branding?.logo_url ? (
              <img src={branding.logo_url} alt={branding?.name || 'Organization logo'} className="h-10 w-auto" />
            ) : (
              <div className="text-sm font-semibold opacity-80">{branding?.name}</div>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="w-full bg-zinc-900 p-8 rounded-xl shadow-lg space-y-5">
          {/* Google */}
          {showGoogle && (
            <>
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-500">
                <span className="h-px flex-1 bg-zinc-700" /> or <span className="h-px flex-1 bg-zinc-700" />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
              disabled={isLoading}
            />
          </div>

          {/* Password (only in password mode) */}
          {mode === 'password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="text-xs text-zinc-400">Password</label>
                <button type="button" onClick={forgotPassword} disabled={isLoading} className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4">
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
                placeholder="••••••••"
                className={inputCls}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Referral code — optional, revealed by a toggle unless prefilled from ?ref/cookie */}
          {showRef ? (
            <div>
              <label htmlFor="refCode" className="block text-xs text-zinc-400 mb-1">Referral code</label>
              <input
                id="refCode"
                type="text"
                value={refCode}
                onChange={(e) => { setRefCode(e.target.value); setRefNote(null); }}
                onBlur={applyRefCode}
                placeholder="e.g. daniel"
                autoCapitalize="none"
                spellCheck={false}
                className={inputCls}
                disabled={isLoading}
              />
              {refNote && (
                <p className={`mt-1 text-xs ${refNote.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>{refNote}</p>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setShowRef(true)} className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4">
              Have a referral code?
            </button>
          )}

          {/* Primary actions */}
          {mode === 'password' ? (
            <div className="space-y-2">
              <button type="submit" disabled={isLoading} className={`w-full text-white py-2 px-4 rounded ${isLoading ? 'bg-zinc-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isLoading ? 'Please wait…' : 'Sign in'}
              </button>
              <button type="button" onClick={createAccount} disabled={isLoading} className="w-full py-2 px-4 rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-60">
                Create account
              </button>
            </div>
          ) : (
            <button type="submit" disabled={isLoading} className={`w-full text-white py-2 px-4 rounded ${isLoading ? 'bg-zinc-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isLoading ? 'Sending…' : 'Send magic link'}
            </button>
          )}

          {/* Mode toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => { setMode((m) => (m === 'password' ? 'magic' : 'password')); setStatus(null); }}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
            >
              {mode === 'password' ? 'Email me a magic link instead' : 'Use a password instead'}
            </button>
          </div>

          {status && (
            <p className={`text-sm ${status.startsWith('✅') ? 'text-green-400' : status.startsWith('❌') ? 'text-red-400' : 'text-yellow-400'}`}>
              {status}
            </p>
          )}

          {/* build stamp */}
          {build && (
            <p className="mt-2 text-center text-[10px] text-zinc-500">
              build <span className="font-mono">{build.sha}</span> • {build.env}
              {build.deployId ? <> • <span className="font-mono">{build.deployId}</span></> : null}
            </p>
          )}

          {showDebug && (
            <div className="text-center text-[10px] text-zinc-500">
              <span className="font-mono">next={nextPath}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
