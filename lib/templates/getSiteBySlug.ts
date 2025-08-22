// lib/templates/getSiteBySlug.ts
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import type { Template } from '@/types/template';
import type { Database } from '@/types/supabase';

// --- server-only admin client (bypasses RLS) with no-store fetch ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  // Fail loudly in logs so we don't silently 404
  // (still return null to keep the page from crashing)
  console.error('[getSiteBySlug] Missing SUPABASE envs');
}

const admin = SUPABASE_URL && SERVICE_KEY
  ? createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      global: {
        // prevent any Next caching of PostgREST calls
        fetch: (input, init: any = {}) =>
          fetch(input, { ...init, cache: 'no-store' }),
        headers: { 'x-qs-srv': 'getSiteBySlug' },
      },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

function normalize(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase();
}

/**
 * Fetch a site by slug in a way that doesn't flap due to RLS/caching.
 * Order of attempts:
 *  1) slug (exact, normalized)
 *  2) base_slug (exact)
 *  3) domain_lc or www.domain_lc from request headers
 */
export async function getSiteBySlug(slug: string): Promise<Template | null> {
  const s = normalize(slug);
  if (!admin || !s) return null;

  // 1) direct slug
  let { data, error } = await admin
    .from('templates')
    .select('*')
    .eq('slug', s)
    .eq('is_site', true)
    .limit(1)
    .maybeSingle<Template>();

  // 2) base_slug fallback
  if (!data) {
    const r2 = await admin
      .from('templates')
      .select('*')
      .eq('base_slug', s)
      .eq('is_site', true)
      .limit(1)
      .maybeSingle<Template>();
    data = r2.data ?? null;
    error = error ?? r2.error ?? null;
  }

  // 3) domain_lc fallback (from incoming Host)
  if (!data) {
    try {
      const h = await headers();
      const rawHost = normalize(h.get('x-forwarded-host') ?? h.get('host'));
      const host = rawHost.replace(/^www\./, '');
      if (host) {
        const r3 = await admin
          .from('templates')
          .select('*')
          .in('domain_lc', [host, `www.${host}`])
          .eq('is_site', true)
          .limit(1)
          .maybeSingle<Template>();
        data = r3.data ?? null;
      }
    } catch {
      // headers() not available in some non-request contexts
    }
  }

  if (!data && error) {
    console.error('[getSiteBySlug] select error:', error);
  }
  if (!data) {
    console.warn(`[getSiteBySlug] not found for "${s}"`);
  }

  return data ?? null;
}
