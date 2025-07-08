import { validateBeforeSave } from '@/admin/lib/validateBeforeSave';
import { supabase } from '@/lib/supabase/client';
import { Template } from '@/types/template';

export async function saveTemplate(template: Template) {
  const safeData = validateBeforeSave(template);

  const { data, error } = await supabase
    .from('templates')
    .update(safeData)
    .eq('id', safeData.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
