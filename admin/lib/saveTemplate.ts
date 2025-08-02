// admin/lib/saveTemplate.ts
import type { Template } from '@/types/template';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Remove only legacy top-level fields (not nested `data.pages`)
function sanitizeTemplateData(raw: any) {
  const {
    slug,
    template_name,
    layout,
    color_scheme,
    industry,
    theme,
    is_site,
    published,
    hero_url,
    banner_url,
    logo_url,
    team_url,
    site_id,
    created_at,
    updated_at,
    domain,
    custom_domain,
    id,
    services, // optional legacy
    pages, // ⚠️ ignore legacy top-level `pages`
    ...rest
  } = raw;

  const fallbackPages = raw?.data?.pages ?? [];
  const fallbackServices = raw?.data?.services ?? services ?? [];

  return {
    ...rest,
    pages: fallbackPages,
    services: fallbackServices,
  };
}

// Save template (upsert)
export async function saveTemplate(template: Omit<Template, 'services'>) {
  const sanitizedData = sanitizeTemplateData(template);
  console.log('🧪 Upserting with sanitized data:', sanitizedData);

  const { data, error } = await supabase
    .from('templates')
    .upsert(
      {
        ...template,
        data: sanitizedData,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase upsert error:', error);
    throw error;
  }

  return data;
}
