// lib/templates/getSiteBySlug.ts
import { getSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

export async function getSiteBySlug(slug: string): Promise<Template | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle<Template>();

  if (error) {
    console.error(`[getSiteBySlug] Failed to fetch site for slug "${slug}": ${error.message}`);
    return null;
  }

  return data ?? null;
}
