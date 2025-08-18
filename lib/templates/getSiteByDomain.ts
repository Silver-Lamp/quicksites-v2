// lib/templates/getSiteByDomain.ts
import { getServerSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

export async function getSiteByDomain(domain: string): Promise<Template | null> {
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('domain', domain)
    .eq('is_site', true)
    .maybeSingle<Template>();

  if (error) {
    console.error(`[getSiteByDomain] ${error.message}`);
    return null;
  }

  return data ?? null;
}
