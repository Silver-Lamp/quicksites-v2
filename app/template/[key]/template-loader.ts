'use server';

import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import type { Database } from '@/types/supabase';

type TemplateRow = Database['public']['Tables']['templates']['Row'];

export async function fetchTemplateBySlug(slug: string): Promise<TemplateRow | null> {
  // Uses server-side Supabase client that’s already wired to Next cookies
  const supabase = await getServerSupabaseClient();

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    console.error('[fetchTemplateBySlug] Supabase error:', error);
    return null;
  }

  return data as TemplateRow;
}
