// admin/lib/saveAsTemplate.ts
import { supabase } from '@/admin/lib/supabaseClient';
import { cleanTemplateDataStructure } from './cleanTemplateData';

export async function saveAsTemplate(template: any, type: 'template' | 'site'): Promise<string | null> {
  const newName = `Copy of ${template.template_name || 'untitled'}`;
  const cleanedData = cleanTemplateDataStructure(template);

  const { data, error } = await supabase
    .from('templates')
    .insert([
      {
        template_name: `${newName} (${type}) ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`,
        slug: `${template.slug}-${type}-${new Date().toISOString().replace('T', '-').substring(0, 19).replace(/:/g, '')}`,
        layout: template.layout,
        color_scheme: template.color_scheme,
        industry: template.industry,
        data: cleanedData,
        is_site: type === 'site',
        published: false,
        domain: null,
        custom_domain: null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Failed to save copy:', error.message);
    return null;
  }

  return data?.id || null;
}
