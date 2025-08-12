// hooks/useTemplateSave.ts
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';
import { cleanAndValidateTemplate } from '@/lib/validation/cleanAndValidateTemplate';

export async function useTemplateSave(template: ValidatedTemplate): Promise<boolean> {

  let validated;
  try {
    validated = cleanAndValidateTemplate(template);
  } catch (error) {
    console.error('[❌ Template validation failed]', error);
    return false;
  }
  if (!validated.success) {
    toast.error('Template is invalid. Cannot save.');
    console.warn('[Validation Error]', (validated.error as any).format());
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

  // toast.success('Template saved!');
  return true;
}
