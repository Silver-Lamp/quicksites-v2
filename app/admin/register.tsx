// app/admin/register.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function RegisterPage() {
  const router = useRouter(); // (kept if you wire post-signup navigation later)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [branding, setBranding] = useState<OrgBranding | null>(null);

  // Feature flags (off by default to avoid localhost network noise)
  const TRY_API =
    process.env.NEXT_PUBLIC_ORG_BRANDING_TRY_API === '1' &&
    !isLocalHost(typeof window !== 'undefined' ? window.location.hostname : '');
  const TRY_DB = process.env.NEXT_PUBLIC_ORG_BRANDING_TRY_DB === '1';

  // Capture referral code if present
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      localStorage.setItem('referrer_id', ref);
      setReferrerId(ref);
    }
  }, []);

  // Load org branding (env → optional API (gated) → Supabase by slug (gated))
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

        // If table/columns missing, try fallbacks
        if (q.error) {
          sel = 'name,logo_url,logo_dark';
          q = await supabase.from('orgs').select(sel).eq('slug', slug).single();
        }
        if (q.error) {
          sel = 'name,logo_url,logo_dark_url';
          q = await supabase.from('organizations').select(sel).eq('slug', slug).single();
        }
        if (q.error) {
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

  const register = async (e: any) => {
    e.preventDefault();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'reseller',
          referrer_id: localStorage.getItem('referrer_id') || null,
        },
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Registration successful! Check your email.');
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto text-white">
      {/* Org logo block (dark/light aware) */}
      {(branding?.logo_url || branding?.logo_dark_url || branding?.name) && (
        <div className="flex flex-col items-center mb-4">
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

      <h1 className="text-2xl font-bold mb-4">Register</h1>

      <form onSubmit={register} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        {referrerId && (
          <p className="text-xs text-gray-400">Signing up via referral: {referrerId}</p>
        )}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-white"
        >
          Create Account
        </button>
        {message && <p className="text-sm text-green-400 mt-2">{message}</p>}
      </form>
    </div>
  );
}
