// lib/templates/getSiteByDomain.ts
import { getServerSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

function normalizeHost(raw: string) {
  // handle inputs like https://www.foo.com:443/path
  let s = (raw || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');       // strip scheme
  s = s.replace(/\/.*$/, '');              // strip path
  s = s.replace(/\.$/, '');                // strip trailing dot
  s = s.replace(/%3a/gi, ':');             // just in case
  const host = s.replace(/:\d+$/, '');     // strip port
  const noWww = host.replace(/^www\./, '');
  const withWww = host.startsWith('www.') ? host : `www.${noWww}`;
  const apexLabel = noWww.split('.').slice(0, -1).join('.') || noWww; // 'graftontowing'
  return { host, noWww, withWww, apexLabel };
}

export async function getSiteByDomain(domain: string): Promise<Template | null> {
  const supabase = await getServerSupabase();
  const n = normalizeHost(domain);

  // Try common variants in one roundtrip
  const candidates = Array.from(new Set([n.host, n.noWww, n.withWww]));

  const { data: domainsHit, error: e1 } = await supabase
    .from('templates')
    .select('*')
    .eq('is_site', true)
    .in('domain', candidates)
    .limit(5);

  if (e1) {
    console.error('[getSiteByDomain] domain query:', e1.message);
  } else if (domainsHit && domainsHit.length) {
    // Prefer exact host match, then noWww, then any
    const exact = domainsHit.find(r => r.domain?.toLowerCase() === n.host);
    const base  = exact ?? domainsHit.find(r => r.domain?.toLowerCase() === n.noWww) ?? domainsHit[0];
    return base as Template;
  }

  // Fallback: treat apex label as slug (handy if you store 'graftontowing' in slug)
  const { data: slugHit, error: e2 } = await supabase
    .from('templates')
    .select('*')
    .eq('is_site', true)
    .eq('slug', n.apexLabel)
    .maybeSingle<Template>();

  if (e2) {
    console.error('[getSiteByDomain] slug fallback:', e2.message);
  }

  return slugHit ?? null;
}
