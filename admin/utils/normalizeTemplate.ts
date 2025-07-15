import type { Template } from '@/types/template';

export function normalizeTemplate(entry: any): Template {
  return {
    id: entry.id,
    site_id: entry.site_id,
    template_name: entry.template_name,
    slug: entry.slug,
    layout: entry.layout,
    color_scheme: entry.color_scheme,
    commit: entry.commit,
    industry: entry.industry,
    theme: entry.theme,
    brand: entry.brand,
    hero_url: entry.hero_url,
    banner_url: entry.banner_url,
    logo_url: entry.logo_url,
    team_url: entry.team_url,
    data: entry.data || { pages: [] },
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    domain: entry.domain,
    published: entry.published,
    custom_domain: entry.custom_domain,
  };
}
