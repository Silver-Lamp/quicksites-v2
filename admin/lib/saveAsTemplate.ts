import { supabase } from '@/admin/lib/supabaseClient';

export async function saveAsTemplate(template: any): Promise<string | null> {
  const newName = `Copy of ${template.template_name || 'untitled'}`;
  const { data, error } = await supabase.from('templates').insert([
    {
      template_name: newName,
      layout: template.layout,
      color_scheme: template.color_scheme,
      industry: template.industry,
      data: template.data
    }
  ]).select().single();

  if (error) {
    console.error('Failed to save copy:', error.message);
    return null;
  }

  return data?.id || null;
}
