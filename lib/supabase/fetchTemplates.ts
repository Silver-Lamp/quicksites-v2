// lib/supabase/fetchTemplates.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function fetchAllTemplates() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data, error } = await supabase
    .from('templates')
    .select('id, slug, template_name, updated_at, industry')
    .order('updated_at', { ascending: false });

  return data || [];
}
