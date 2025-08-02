import type { Template } from '@/types/template';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function sanitizeTemplateData(raw: any) {
  const cleaned = { ...raw.data };
  if (Array.isArray(cleaned.pages)) {
    cleaned.pages = cleaned.pages.map(({ site_id, ...rest }: any) => rest);
  }
  return cleaned;
}

export async function saveTemplate(template: Omit<Template, 'services'>) {
  const sanitizedData = sanitizeTemplateData(template);

  const { data, error } = await supabase
    .from('templates')
    .upsert(
      {
        ...template,
        data: sanitizedData,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase upsert error:', error);
    throw error;
  }

  return data;
}
