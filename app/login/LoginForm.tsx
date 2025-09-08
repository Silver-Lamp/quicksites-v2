// app/login/LoginForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient as createBrowserClient } from '@supabase/supabase-js';

type BuildInfo = { sha?: string; env?: string; deployId?: string };

type OrgBranding = {
  name?: string | null;
  logo_url?: string | null;       // light/default logo
  logo_dark_url?: string | null;  // dark-mode logo (optional)
};

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginForm({ build }: { build?: BuildInfo }) {
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = sp.get('next') || sp.get('redirectTo') || '/admin/templates/list';
    return n.startsWith('/') ? n : '/admin/templates/list';
  }, [sp]);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [branding, setBranding] = useState<OrgBranding | null>(null);

  // Browser Supabase client (inherits user session from local storage)
  const sb = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

  // optional: prefill during local dev
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@pointsevenstudio.com');
    }
  }, []);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;

    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) {
      setStatus('❌ Please enter a valid email.');
      return;
    }

    setIsLoading(true);
    setStatus('Sending magic link…');

    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

      if (process.env.NODE_ENV !== 'production') {
        // 🔒 DEV: send from the browser so redirect_to is always localhost
        console.debug('[login] dev fallback → client signInWithOtp', { redirectTo });
        const { error } = await sb.auth.signInWithOtp({
          email: emailNorm,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        });
        if (error) throw error;
        setStatus('✅ Check your email for the magic link.');
        return;
      }

      // PROD: preferred flow via server route (uses the same redirectTo)
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNorm, next: nextPath }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        console.warn('[login] server route failed; fallback to client', data);
        const { error } = await sb.auth.signInWithOtp({
          email: emailNorm,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        });
        if (error) throw error;
      }

      setStatus('✅ Check your email for the magic link.');
    } catch (err: any) {
      console.error('[login] error', err);
      setStatus(`❌ ${err?.message || 'Network error. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showDebug = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md">
        {/* Org logo (dark/light aware if both provided) */}
        {(branding?.logo_url || branding?.logo_dark_url || branding?.name) && (
          <div className="flex flex-col items-center mb-6">
            {branding?.logo_dark_url ? (
              <>
                <img
                  src={branding.logo_url || branding.logo_dark_url}
                  alt={branding?.name || 'Organization logo'}
                  className="block dark:hidden h-10 w-auto"
                />
                <img
                  src={branding.logo_dark_url}
                  alt={branding?.name || 'Organization logo'}
                  className="hidden dark:block h-10 w-auto"
                />
              </>
            ) : branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding?.name || 'Organization logo'}
                className="h-10 w-auto"
              />
            ) : (
              <div className="text-sm font-semibold opacity-80">{branding?.name}</div>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="w-full bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
          <label htmlFor="email" className="sr-only">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="you@example.com"
            className="w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white py-2 px-4 rounded ${isLoading ? 'bg-zinc-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isLoading ? 'Sending…' : 'Send Magic Link'}
          </button>

          {status && (
            <p
              className={`text-sm mt-4 ${
                status.startsWith('✅') ? 'text-green-400' :
                status.startsWith('❌') ? 'text-red-400' : 'text-yellow-400'
              }`}
            >
              {status}
            </p>
          )}

          {/* build stamp */}
          {build && (
            <p className="mt-6 text-center text-[10px] text-zinc-500">
              build <span className="font-mono">{build.sha}</span> • {build.env}
              {build.deployId ? <> • <span className="font-mono">{build.deployId}</span></> : null}
            </p>
          )}

          {/* dev-only debug footer */}
          {showDebug && (
            <div className="mt-2 text-center text-[10px] text-zinc-500">
              <span className="font-mono">next={nextPath}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
