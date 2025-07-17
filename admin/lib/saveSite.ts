import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import type { Template } from '@/types/template';

export async function saveSite(site: Template): Promise<Template> {
  const supabase = createClientComponentClient<Database>();

  const { data, error } = await supabase
    .from('sites')
    .update({
      site_name: site.site_name,
      slug: site.slug,
      data: site.data,
      theme: site.theme,
      brand: site.brand,
      layout: site.layout,
      color_scheme: site.color_scheme,
      is_site: true,
    })
    .eq('id', site.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Template;
}
