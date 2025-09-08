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
 * Resolve a site by domain. Order of precedence:
 *   1) public.sites.domain ∈ {host, noWww, withWww}
 *   2) public.templates.{domain_lc|custom_domain|domain} ∈ candidates
 *   3) slug fallback (apex label) via sites then templates
 */
export async function getSiteByDomain(domain: string): Promise<Template | null> {
  const supabase = await getServerSupabase();
  const n = normalizeHost(domain);
  const candidates = Array.from(new Set([n.host, n.noWww, n.withWww]));

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
      return data[0] as unknown as Template;
    }
  }

  // 2) Legacy fallbacks from `templates`
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
      return data[0] as unknown as Template;
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
