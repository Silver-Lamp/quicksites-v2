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
  if (!id) throw new Error('Missing or invalid template.id');

  const incomingPages =
    Array.isArray(template?.data?.pages) ? template.data!.pages! : [];

  let dbPayload = prepareTemplateForSave({ ...template, id });

  // Safety: don’t allow pages to drop on the floor
  const outgoingPages =
    Array.isArray(dbPayload?.data?.pages) ? dbPayload.data.pages : [];

  if (incomingPages.length > 0 && outgoingPages.length === 0) {
    console.warn('⚠️ [saveTemplate] Restoring pages into payload to prevent drop.', {
      restoredCount: incomingPages.length,
    });
    dbPayload = {
      ...dbPayload,
      data: { ...(dbPayload.data ?? {}), pages: incomingPages },
    };
  }

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
