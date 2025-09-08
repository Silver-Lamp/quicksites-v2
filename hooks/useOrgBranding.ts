'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export type OrgBranding = {
  name?: string | null;
  logo_url?: string | null;
  logo_dark_url?: string | null;
};

const GENERIC_SUBS = new Set(['www', 'app', 'admin', 'login']);

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
    const qs = new URLSearchParams(window.location.search);
    const forced =
      qs.get('org') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('org_slug')) ||
      process.env.NEXT_PUBLIC_ORG_SLUG ||
      null;
    if (forced) return forced;

    const host = window.location.hostname;
    if (isLocalHost(host)) return null;

    const sub = (host.split('.')[0] || '').toLowerCase();
    if (!sub || GENERIC_SUBS.has(sub)) return null;
    return sub;
  } catch {
    return null;
  }
}

/**
 * Source order:
 * 1) Env vars
 * 2) /api/org/branding (disabled on localhost unless NEXT_PUBLIC_ORG_BRANDING_TRY_API=1)
 * 3) Supabase by slug (only if we have a real slug)
 */
export function useOrgBranding(opts?: { tryApi?: boolean; tryDb?: boolean }) {
  const [branding, setBranding] = useState<OrgBranding | null>(null);

  const tryApiEnvDefault =
    (process.env.NODE_ENV === 'production' ? '1' : '0') === '1';
  const tryApi =
    opts?.tryApi ??
    (process.env.NEXT_PUBLIC_ORG_BRANDING_TRY_API === '1' || tryApiEnvDefault);
  const tryDb = opts?.tryDb ?? true;

  useEffect(() => {
    let cancelled = false;

    const envLogo = process.env.NEXT_PUBLIC_LOGIN_LOGO_URL || null;
    const envLogoDark = process.env.NEXT_PUBLIC_LOGIN_LOGO_DARK_URL || null;
    const envName = process.env.NEXT_PUBLIC_ORG_NAME || null;
    if (envLogo || envLogoDark || envName) {
      setBranding({ name: envName, logo_url: envLogo, logo_dark_url: envLogoDark });
      return;
    }

    async function load() {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const slug = resolveCandidateSlug();

      // 2) API route (skip on localhost unless explicitly enabled)
      if (tryApi && host && !isLocalHost(host)) {
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

      // 3) DB by slug (only if we truly have one)
      if (tryDb && slug) {
        try {
          let { data: row } = await supabase
            .from('orgs')
            .select('name, logo_url, logo_dark_url')
            .eq('slug', slug)
            .single();

          if (!row) {
            const alt = await supabase
              .from('organizations')
              .select('name, logo_url, logo_dark_url')
              .eq('slug', slug)
              .single();
            row = alt.data ?? null;
          }

          if (!cancelled && row) {
            setBranding({
              name: row.name ?? null,
              logo_url: row.logo_url ?? null,
              logo_dark_url: row.logo_dark_url ?? null,
            });
          }
        } catch {
          /* ignore */
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tryApi, tryDb]);

  return branding;
}
