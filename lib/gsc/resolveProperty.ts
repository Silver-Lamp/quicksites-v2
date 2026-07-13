// lib/gsc/resolveProperty.ts
//
// Resolve a campaign's bare domain (e.g. "boston-towing.com") to the actual GSC *property*
// string stored in gsc_tokens (e.g. "sc-domain:boston-towing.com" or "https://…/"). The
// geo-rank-sync cron historically passed the bare domain straight to searchanalytics, which
// isn't a valid property id for a domain property, so per-campaign rank silently returned
// null. Resolving here fixes both the token lookup AND the searchanalytics siteUrl.

import { createClient } from '@supabase/supabase-js';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

/**
 * Pure: given the connected properties (as stored in gsc_tokens.domain) keyed by their
 * normalized domain, pick the property for a target domain. Prefers an existing exact key
 * match. Returns null when the domain isn't connected to GSC.
 */
export function gscPropertyFor(map: Map<string, string>, domain: string): string | null {
  const key = normalizeGscDomain(domain);
  if (!key) return null;
  return map.get(key) ?? null;
}

/** Build normalizedDomain → property-string map from gsc_tokens (one query; small table). */
export async function loadGscPropertyMap(): Promise<Map<string, string>> {
  const { data } = await db().from('gsc_tokens').select('domain');
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const property = (row as { domain: string | null }).domain;
    if (!property) continue;
    const key = normalizeGscDomain(property);
    // Prefer a domain property (sc-domain:) over a URL-prefix when both exist for a key.
    if (key && (!map.has(key) || property.startsWith('sc-domain:'))) map.set(key, property);
  }
  return map;
}
