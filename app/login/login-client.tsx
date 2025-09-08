// app/login/login-client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { supabase } from '@/admin/lib/supabaseClient';

type OrgBranding = {
  name?: string | null;
  logo_url?: string | null;
  logo_dark_url?: string | null;
};

function isLocalHost(host: string) {
  const h = (host || '').toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.localhost') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h) // any IPv4
  );
}

function resolveCandidateSlug(): string | null {
  try {
    // 1) explicit overrides first
    const qs = new URLSearchParams(window.location.search);
    const forced =
      qs.get('org') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('org_slug')) ||
      process.env.NEXT_PUBLIC_ORG_SLUG ||
      null;
    if (forced) return forced;

    // 2) derive from subdomain if non-generic + not localhost
    const host = window.location.hostname;
    if (isLocalHost(host)) return null;

    const sub = host.split('.')[0]?.toLowerCase() || '';
    const genericSubs = new Set(['www', 'app', 'admin', 'login']);
    if (!sub || genericSubs.has(sub)) return null;
    return sub;
  } catch {
    return null;
  }
}

export default function LoginClient() {
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<OrgBranding | null>(null);

  // Feature flags (off by default to avoid localhost network noise)
  const TRY_API =
    process.env.NEXT_PUBLIC_ORG_BRANDING_TRY_API === '1' &&
    !isLocalHost(typeof window !== 'undefined' ? window.location.hostname : '');
  const TRY_DB = process.env.NEXT_PUBLIC_ORG_BRANDING_TRY_DB === '1';

  // Autofill in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@pointsevenstudio.com');
    }
  }, []);

  // Load org branding: env → optional API (gated) → Supabase (gated + real slug)
  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      // 1) Env overrides (fast path, zero network)
      const envLogo = process.env.NEXT_PUBLIC_LOGIN_LOGO_URL || null;
      const envLogoDark = process.env.NEXT_PUBLIC_LOGIN_LOGO_DARK_URL || null;
      const envName = process.env.NEXT_PUBLIC_ORG_NAME || null;
      if (envLogo || envLogoDark || envName) {
        if (!cancelled) setBranding({ name: envName, logo_url: envLogo, logo_dark_url: envLogoDark });
        return;
      }

      // 2) Optional API route (NEVER called on localhost unless enabled)
      if (TRY_API) {
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
      }

      // 3) Supabase by slug (only if enabled AND we actually have one)
      if (!TRY_DB) return;
      const slug = resolveCandidateSlug();
      if (!slug) return;

      try {
        // Try orgs (modern) with url fields
        let sel = 'name,logo_url,logo_dark_url';
        let q = await supabase.from('orgs').select(sel).eq('slug', slug).single();

        // If table missing or columns missing, try fallbacks
        if (q.error) {
          // Try orgs with old dark column
          sel = 'name,logo_url,logo_dark';
          q = await supabase.from('orgs').select(sel).eq('slug', slug).single();
        }
        if (q.error) {
          // Try organizations (legacy) with url fields
          sel = 'name,logo_url,logo_dark_url';
          q = await supabase.from('organizations').select(sel).eq('slug', slug).single();
        }
        if (q.error) {
          // Try organizations (legacy) with old dark column
          sel = 'name,logo_url,logo_dark';
          q = await supabase.from('organizations').select(sel).eq('slug', slug).single();
        }

        const row: any = q.data ?? null;
        if (row && !cancelled) {
          setBranding({
            name: row.name ?? null,
            logo_url: row.logo_url ?? row.logo ?? null,
            logo_dark_url: row.logo_dark_url ?? row.logo_dark ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    }

    loadBranding();
    return () => {
      cancelled = true;
    };
  }, [TRY_API, TRY_DB]);

  // Check for active session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        fetch('/api/session-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referer: document.referrer }),
        })
          .catch((err) => console.error('Error logging session:', err))
          .finally(() => {
            window.location.href = '/auth/callback';
          });
      }
    });
  }, []);

  // Listen for successful login
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        fetch('/api/session-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referer: document.referrer }),
        })
          .catch((err) => console.error('Error logging session:', err))
          .finally(() => {
            window.location.href = '/auth/callback';
          });
      }
    });

    return () => subscription?.unsubscribe?.();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    const token = await recaptchaRef.current?.executeAsync();
    recaptchaRef.current?.reset();

    if (!token) {
      setMessage('❌ reCAPTCHA failed. Please try again.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, recaptchaToken: token }),
    });

    const data = await res.json();
    setMessage(
      res.ok ? '✅ Check your email for the magic link.' : `❌ ${data.error || 'Login failed.'}`
    );
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
        {/* Org logo block (dark/light aware) */}
        {(branding?.logo_url || branding?.logo_dark_url || branding?.name) && (
          <div className="flex flex-col items-center -mt-2 mb-2">
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

        <h1 className="text-2xl font-extrabold text-center">Login</h1>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleLogin();
            }
          }}
          placeholder="you@example.com"
          className="w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-medium transition disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>

        {message && (
          <p
            className={`text-sm text-center ${
              message.startsWith('✅') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}

        <ReCAPTCHA
          sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
          size="invisible"
          ref={recaptchaRef}
        />
      </div>
    </main>
  );
}
