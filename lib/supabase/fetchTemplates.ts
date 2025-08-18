// lib/supabase/fetchTemplates.ts
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function fetchAllTemplates() {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from('templates')
    .select('id, slug, template_name, updated_at, industry')
    .order('updated_at', { ascending: false });

  return data || [];
}
