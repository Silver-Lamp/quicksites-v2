'use server';

import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import type { Database } from '@/types/supabase';

type TemplateRow = Database['public']['Tables']['templates']['Row'];

const SELECT =
  'id,slug,template_name,updated_at,created_at,is_site,is_version,archived,industry,color_mode,data,header_block,footer_block,base_slug';

export async function fetchTemplateBySlug(slug: string): Promise<TemplateRow | any> {
  const supabase = await getServerSupabaseClient() as any;
  const { data, error } = await (supabase as any)
    .from('templates')
    .select(SELECT)
    .eq('slug', slug)
    .single();
  if (error || !data) return null as any;
  return data as TemplateRow | any;
}
