// lib/sites/context.ts
import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function normalizeHost(h?: string | null) {
  if (!h) return null;
  return h.split(':')[0].replace(/^www\./i, '').toLowerCase();
}

/**
 * Best-effort site resolver:
 * - header "x-site-id"
 * - body-provided slug (optional, pass in opts.slug)
 * - ?site_id= or ?site=
 * - host lookup via domains/site_domains tables
 * - Referer path like /candidate/:slug → sites.slug
 */
export async function getActiveSiteId(
  req: NextRequest,
  opts?: { slug?: string; headerKey?: string }
): Promise<string | null> {
  const supabase = await getServerSupabase();
  const headerKey = opts?.headerKey ?? 'x-site-id';

  // 1) explicit header
  const fromHeader = req.headers.get(headerKey);
  if (fromHeader) return fromHeader;

  // 2) slug override
  if (opts?.slug) {
    const { data } = await supabase
      .from('sites')
      .select('id')
      .eq('slug', opts.slug)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 3) query param
  const url = req.nextUrl;
  const siteFromQuery = url.searchParams.get('site_id') || url.searchParams.get('site');
  if (siteFromQuery) return siteFromQuery;

  // 4) host → domains map
  const host = normalizeHost(req.headers.get('x-forwarded-host') || req.headers.get('host'));
  if (host) {
    // try `domains` table
    const { data: d1 } = await supabase
      .from('domains')
      .select('site_id, hostname')
      .eq('hostname', host)
      .maybeSingle();
    if (d1?.site_id) return d1.site_id;

    // try `site_domains` table
    const { data: d2 } = await supabase
      .from('site_domains')
      .select('site_id, domain')
      .eq('domain', host)
      .maybeSingle();
    if (d2?.site_id) return d2.site_id;
  }

  // 5) Referer like /candidate/:slug
  const ref = req.headers.get('referer');
  if (ref) {
    try {
      const u = new URL(ref);
      const m = u.pathname.match(/\/candidate\/([^/?#]+)/i);
      const slug = m?.[1];
      if (slug) {
        const { data } = await supabase
          .from('sites')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        if (data?.id) return data.id;
      }
    } catch {}
  }

  return null;
}
