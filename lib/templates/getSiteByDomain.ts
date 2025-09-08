// lib/templates/getSiteByDomain.ts
import { getServerSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

function normalizeHost(raw: string) {
  // handle inputs like https://www.foo.com:443/path
  let s = (raw || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, ''); // strip scheme
  s = s.replace(/\/.*$/, '');        // strip path
  s = s.replace(/\.$/, '');          // strip trailing dot
  s = s.replace(/%3a/gi, ':');       // just in case
  const host = s.replace(/:\d+$/, ''); // strip port

  const noWww = host.replace(/^www\./, '');
  const withWww = host.startsWith('www.') ? host : `www.${noWww}`;

  // derive apex label from the *apex* host (no www)
  // e.g., www.graftontowing.com -> graftontowing
  const apexLabel = noWww.split('.').slice(0, -1).join('.') || noWww;

  return { host, noWww, withWww, apexLabel };
}

/**
 * Merge site identity into a template object and *unify* services so downstream
 * renderers can reliably read:
 *   - template.services
 *   - template.data.services
 *   - template.data.meta.services
 *
 * Also overlays site.meta (business/contact/industry/etc.) onto template.data.meta
 * so published pages can resolve identity from the template alone.
 */
function unifyFromSite(site: any, tpl: any): Template {
  const siteData = site?.data ?? {};
  const siteMeta = siteData?.meta ?? {};

  const tplData = tpl?.data ?? {};
  const tplMeta = tplData?.meta ?? {};

  // Prefer site.services/meta.services first, then template-level.
  const serviceCandidates = [
    siteMeta.services,
    siteData.services,
    tplData.services,
    tplMeta.services,
    tpl?.services,
  ];

  const firstArr: any[] =
    (serviceCandidates.find((v) => Array.isArray(v) && v.length > 0) as any[]) || [];

  const services = Array.from(
    new Set(firstArr.map((s) => String(s ?? '').trim()).filter(Boolean))
  );

  const mergedMeta = {
    ...tplMeta,
    ...siteMeta, // site-level identity wins
    services,
  };

  return {
    ...(tpl || {}),
    services,
    data: {
      ...tplData,
      services,
      meta: mergedMeta,
    },
  } as Template;
}

/**
 * Resolve a site by domain. Order of precedence:
 *   1) public.sites.domain ∈ {host, noWww, withWww}
 *      -> If a site is found, also fetch its template by site.template_id and return a merged template.
 *   2) public.templates.{domain_lc|custom_domain|domain} ∈ candidates (legacy)
 *   3) slug fallback (apex label) via sites then templates
 */
export async function getSiteByDomain(domain: string): Promise<Template | null> {
  const supabase = await getServerSupabase();
  const n = normalizeHost(domain);
  const candidates = Array.from(new Set([n.host, n.noWww, n.withWww]));

  // Helper to load a template by id (best-effort)
  const loadTemplateById = async (id?: string | null) => {
    if (!id) return null;
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[getSiteByDomain] loadTemplateById:', error.message);
    }
    return data || null;
  };

  // 1) Prefer the `sites` table (new source of truth)
  {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .in('domain', candidates)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[getSiteByDomain] sites.domain query:', error.message);
    } else if (data && data.length) {
      const site = data[0];

      // Try to fetch the linked template; if missing, fall back to a bare object
      const tpl = (await loadTemplateById(site.template_id)) || {};
      const merged = unifyFromSite(site, tpl);
      return merged;
    }
  }

  // 2) Legacy fallbacks from `templates` (domain match)
  for (const col of ['domain_lc', 'custom_domain', 'domain'] as const) {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_site', true)
      .in(col, candidates)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(`[getSiteByDomain] templates.${col} query:`, error.message);
      continue;
    }
    if (data && data.length) {
      // No site context; just return the template as-is
      return data[0] as Template;
    }
  }

  // 3) Fallback: treat apex label as slug (try sites first, then templates)
  {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('slug', n.apexLabel)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[getSiteByDomain] sites slug fallback:', error.message);
    } else if (data && data.length) {
      const site = data[0];
      const tpl = (await loadTemplateById(site.template_id)) || {};
      const merged = unifyFromSite(site, tpl);
      return merged;
    }
  }

  {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_site', true)
      .eq('slug', n.apexLabel)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[getSiteByDomain] templates slug fallback:', error.message);
    } else if (data && data.length) {
      return data[0] as Template;
    }
  }

  return null;
}
