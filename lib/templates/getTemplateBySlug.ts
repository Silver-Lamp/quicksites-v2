// lib/templates/getTemplateBySlug.ts
import { getSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

export async function getTemplateBySlug(slug: string): Promise<Template | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<Template>();

  if (error) {
    console.error(`[getTemplateBySlug] ${error.message}`);
    return null;
  }

  return data ?? null;
}
