// hooks/useTemplateSave.ts
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';

export async function useTemplateSave(template: ValidatedTemplate): Promise<boolean> {
  const validated = TemplateSaveSchema.safeParse(template);
  if (!validated.success) {
    toast.error('Template is invalid. Cannot save.');
    console.warn('[Validation Error]', validated.error.format());
    return false;
  }

  const { data, error } = await supabase
    .from('templates')
    .update(validated.data)
    .eq('id', template.id);

  if (error) {
    toast.error('Save failed');
    return false;
  }

  toast.success('Template saved!');
  return true;
}
