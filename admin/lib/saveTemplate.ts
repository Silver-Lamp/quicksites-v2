// admin/lib/saveTemplate.ts
import type { Template } from '../../types/template';
import { createClient } from '@supabase/supabase-js';
import { prepareTemplateForSave } from './prepareTemplateForSave';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function saveTemplate(template: Template, templateId?: string) {
  const id = templateId || template.id;
  if (!id) throw new Error('Missing or invalid template.id');

  // 🔒 Always carry a color_mode through the entire save cycle
  const ensuredColor: 'light' | 'dark' =
    ((template as any).color_mode as 'light' | 'dark' | undefined) ?? 'light';

  const incomingPages =
    Array.isArray(template?.data?.pages) ? template.data!.pages! : [];

  // Run your normal cleaner, but seed color_mode in case the cleaner strips it
  let dbPayload: any = prepareTemplateForSave({ ...template, id, color_mode: ensuredColor });

  // Re-assert color_mode after prepare step (belt & suspenders)
  if (!dbPayload || typeof dbPayload !== 'object') dbPayload = { id };
  dbPayload.color_mode = dbPayload.color_mode ?? ensuredColor;

  // 🛟 Safety: don’t allow pages to drop on the floor
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

  console.log('🟣 Upserting with payload (color_mode=%s):', dbPayload.color_mode, dbPayload);

  const { data, error } = await supabase
    .from('templates')
    .upsert(dbPayload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase upsert error:', error);
    throw error;
  }

  // Echo back color_mode even if the DB/view omits it in the response
  const result = data ? { ...data, color_mode: (data as any)?.color_mode ?? ensuredColor } : data;

  console.log('🟢 Saved template (color_mode=%s)', (result as any)?.color_mode);
  return result as typeof data;
}
