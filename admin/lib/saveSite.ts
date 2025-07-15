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
      seo_title: site.seo_title,
      seo_description: site.seo_description,
      twitter_handle: site.twitter_handle,
      template_id: site.template_id,
      branding_profile_id: site.branding_profile_id,
      is_published: site.is_published,
    })
    .eq('id', site.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Template;
}
