// lib/templates/getSiteBySlug.ts
import { getServerSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

type GetSiteOptions = {
  /** Require is_site=true. Defaults to false to avoid 404s on older rows. */
  requireIsSite?: boolean;
  /** If you later add a published flag, you can turn this on. Defaults to false. */
  requirePublished?: boolean;
};

export async function getSiteBySlug(
  slug: string,
  opts: GetSiteOptions = {}
): Promise<Template | null> {
  const normalized = (slug ?? '').trim().toLowerCase();
  if (!normalized) return null;

  const supabase = await getServerSupabase();

  // Helper to query a table/view with optional filters
  const fetchOne = async (table: string, allowNonSiteFallback: boolean) => {
    let q = supabase.from(table).select('*').eq('slug', normalized).limit(1);

    if (opts.requireIsSite) q = q.eq('is_site', true as any);
    if (opts.requirePublished) q = q.eq('published', true as any);

    // Primary attempt
    let { data, error } = (await q.maybeSingle()) as {
      data: Template | null;
      error: any;
    };

    // If we required is_site and got nothing, try again without that filter
    if (!data && opts.requireIsSite && allowNonSiteFallback) {
      let q2 = supabase.from(table).select('*').eq('slug', normalized).limit(1);
      if (opts.requirePublished) q2 = q2.eq('published', true as any);
      const res2 = (await q2.maybeSingle()) as { data: Template | null; error: any };
      data = res2.data;
      error = error ?? res2.error;
    }

    return { data, error };
  };

  // 1) Prefer a public view if present (ignore if it doesn't exist)
  let data: Template | null = null;

  try {
    const res = await fetchOne('templates_public', true);
    data = res.data;
    // If the view doesn't exist, PostgREST returns an error; we silently fall back.
  } catch (_e) {
    // no-op: view likely not present
  }

  // 2) Fall back to the base table
  if (!data) {
    const res = await fetchOne('templates', true);
    if (res.error && String(res.error?.message || '').toLowerCase().includes('not exist')) {
      // Table missing would be catastrophic; log and bail
      console.error(`[getSiteBySlug] base table not found:`, res.error);
    }
    data = res.data;
  }

  // 3) Final fallback: case-insensitive match (defensive)
  if (!data) {
    let q = supabase.from('templates').select('*').ilike('slug', normalized).limit(1);
    if (opts.requirePublished) q = q.eq('published', true as any);
    const { data: ilikeData, error: ilikeErr } = (await q.maybeSingle()) as {
      data: Template | null;
      error: any;
    };
    if (ilikeErr) {
      console.error(`[getSiteBySlug] ilike fallback error for "${normalized}":`, ilikeErr);
    }
    data = ilikeData ?? null;
  }

  if (!data) {
    console.warn(`[getSiteBySlug] not found for slug "${normalized}"`);
  }

  return data ?? null;
}
