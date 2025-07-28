import type { Template } from '@/types/template';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// Handles both create + update via upsert
export async function saveTemplate(template: Omit<Template, 'services'>) {
  const { data, error } = await supabase
    .from('templates')
    .upsert(template, { onConflict: 'id' }) // upsert on ID
    .select('*') // return updated row
    .maybeSingle(); // avoid "JSON object requested..." errors

  if (error) {
    console.error('❌ Supabase upsert error:', error);
    throw error;
  }

  return data;
}
