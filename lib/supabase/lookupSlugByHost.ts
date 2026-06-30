'use server';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

const _slugCache = new Map<string, string | null>();

export async function lookupSlugByHost(host: string): Promise<string | null> {
  if (_slugCache.has(host)) return _slugCache.get(host)!;

  const subdomain = host.split('.')?.[0];

  // public_sites has no subdomain column in live DB — cast to any (was failing silently); see types migration
  const { data: subMatch }: { data: { slug: string } | null } = await (supabaseAdmin as any)
    .from('public_sites')
    .select('slug')
    .eq('subdomain', subdomain)
    .single();

  if (subMatch && typeof subMatch.slug === 'string') {
    _slugCache.set(host, subMatch.slug);
    return subMatch.slug as string;
  }

  return null;
}
