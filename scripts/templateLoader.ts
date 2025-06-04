import { toast } from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function fetchTemplateByName(templateName: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('template_name', templateName)
    .single();

  if (error || !data) {
    toast.error('Failed to load template from DB');
    return null;
  }

  return data;
}

export function getDraft(templateId: string) {
  const key = `draft-${templateId}`;
  const saved = localStorage.getItem(key);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    if (parsed?.pages?.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function discardDraft(templateId: string) {
  const key = `draft-${templateId}`;
  localStorage.removeItem(key);
  toast.success('Draft discarded');
}
