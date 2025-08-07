// admin/lib/saveTemplate.ts

import type { Template } from '@/types/template';
import { createClient } from '@supabase/supabase-js';
import { prepareTemplateForSave } from './prepareTemplateForSave';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function saveTemplate(template: Template, templateId?: string) {
  const id = templateId || template.id;
  if (!id || id === '') {
    throw new Error('Missing or invalid template.id');
  }

  const dbPayload = prepareTemplateForSave({ ...template, id });

  console.log('🟣 Upserting with payload:', dbPayload);

  const { data, error } = await supabase
    .from('templates')
    .upsert(dbPayload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase upsert error:', error);
    throw error;
  }

  return data;
}
