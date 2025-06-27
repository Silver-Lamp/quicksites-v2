'use server';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const _slugCache = new Map<string, string | null>();

export async function lookupSlugByHost(host: string): Promise<string | null> {
  if (_slugCache.has(host)) return _slugCache.get(host)!;

  const subdomain = host.split('.')?.[0];

  const { data: subMatch } = await supabaseAdmin
    .from('public_sites')
    .select('slug')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (subMatch?.slug) {
    _slugCache.set(host, subMatch.slug);
    return subMatch.slug;
  }

  const { data: domainMatch } = await supabaseAdmin
    .from('public_sites')
    .select('slug')
    .eq('domain', host)
    .maybeSingle();

  const resolved = domainMatch?.slug ?? null;
  _slugCache.set(host, resolved);
  return resolved;
}
