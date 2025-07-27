import type { Template } from '@/types/template';
export function normalizeTemplate(entry: any): Template {
  const pages = entry.data?.pages ?? entry.pages ?? [];
  const services = entry.services ?? entry.data?.services ?? [];

  // Prefer explicitly passed values first
  const rawName = entry.template_name?.trim();
  const rawSlug = entry.slug?.trim();
  const industry = entry.industry?.trim() ?? '';

  // Fallback derivation logic
  const derivedName = rawName || 'Untitled';
  const derivedSlug = rawSlug || derivedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();

  // Hero block fallback metadata
  const heroBlock = pages[0]?.content_blocks?.find((b: any) => b.type === 'hero');
  const fallbackTitle = derivedName || heroBlock?.content?.headline || '';
  const fallbackDesc = heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';

  return {
    id: entry.id,
    site_id: entry.site_id ?? '',
    template_name: derivedName,
    slug: derivedSlug,
    layout: entry.layout ?? 'standard',
    color_scheme: entry.color_scheme ?? 'neutral',
    theme: entry.theme ?? 'default',
    brand: entry.brand ?? 'default',
    commit: entry.commit ?? '',
    industry,
    hero_url: entry.hero_url ?? '',
    banner_url: entry.banner_url ?? '',
    logo_url: entry.logo_url ?? '',
    team_url: entry.team_url ?? '',
    is_site: entry.is_site ?? false,
    created_at: entry.created_at ?? '',
    updated_at: entry.updated_at ?? '',
    domain: entry.domain ?? '',
    custom_domain: entry.custom_domain ?? '',
    published: entry.published ?? false,
    verified: entry.verified ?? false,

    services: Array.isArray(services) ? services : [],

    meta: {
      title: entry.meta?.title?.trim() || fallbackTitle,
      description: entry.meta?.description?.trim() || fallbackDesc,
      ogImage: entry.meta?.ogImage ?? '',
      faviconSizes: entry.meta?.faviconSizes ?? '',
      appleIcons: entry.meta?.appleIcons ?? '',
      ...entry.meta,
    },

    data: {
      pages,
      services: Array.isArray(services) ? services : [],
      ...entry.data,
    },
  };
}
