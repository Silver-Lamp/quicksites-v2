// admin/utils/normalizeTemplate.ts
import type { Template } from '@/types/template';

export function normalizeTemplate(entry: any): Template {
  const rawPages = entry.data?.pages ?? entry.pages ?? [];
  const services = entry.services ?? entry.data?.services ?? [];

  const pages = Array.isArray(rawPages)
    ? rawPages.map((page: any, i: number) => {
        const {
          site_id, // ❌ Strip fields not in schema
          ...rest
        } = page;
        return {
          id: rest.id || `page-${i}`,
          slug: rest.slug || 'home',
          title: rest.title || 'Home',
          show_footer: rest.show_footer ?? true,
          show_header: rest.show_header ?? true,
          content_blocks: Array.isArray(rest.content_blocks) ? rest.content_blocks : [],
          ...rest,
        };
      })
    : [];

  const rawName = entry.template_name?.trim();
  const rawSlug = entry.slug?.trim();
  const industry = entry.industry?.trim() ?? '';

  const derivedName = rawName || rawSlug || `new-template-${Math.random().toString(36).slice(2, 6)}`;
  const derivedSlug = rawSlug || derivedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const heroBlock = pages[0]?.content_blocks?.find((b: any) => b.type === 'hero');
  const fallbackTitle = derivedName || heroBlock?.content?.headline || '';
  const fallbackDesc = heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';

  const normalized: Template = {
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
      ...entry.data,
      services: Array.isArray(services) ? services : [],
      pages,
    },
  };

  delete (normalized as any).pages;
  return normalized;
}
