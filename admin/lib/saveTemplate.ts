// admin/lib/saveTemplate.ts
import type { Template } from '@/types/template';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function sanitizeTemplateData(raw: any) {
  const {
    slug,
    template_name,
    layout,
    color_scheme,
    industry,
    theme,
    font,
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
    color_mode,
    services,
    pages,
    ...rest
  } = raw;

  const fallbackPages = raw?.data?.pages ?? [];
  const fallbackServices = raw?.data?.services ?? services ?? [];

  return {
    ...rest,
    pages: fallbackPages,
    services: fallbackServices,
    color_mode,
    theme,
    font,
  };
}

export async function saveTemplate(template: Omit<Template, 'services' | 'font'>, templateId?: string) {
  const id = templateId || template.id;
  if (!id || id === '') {
    throw new Error('Missing or invalid template.id');
  }

  const sanitizedData = sanitizeTemplateData(template);

  const upsertPayload = {
    id,
    data: sanitizedData,
    color_mode: sanitizedData.color_mode,
    template_name: template.template_name,
    layout: template.layout,
    color_scheme: template.color_scheme,
    industry: template.industry,
    theme: template.theme,
    font: template.font,
    brand: template.brand || 'default',
    site_id: template.site_id || null,
    slug: template.slug,
    verified: template.verified || false,
    published: template.published || false,
    phone: (template as any).phone || null,
  };

  console.log('🟣 Upserting with payload:', upsertPayload);

  const { data, error } = await supabase
    .from('templates')
    .upsert(upsertPayload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase upsert error:', error);
    throw error;
  }

  return data;
}
