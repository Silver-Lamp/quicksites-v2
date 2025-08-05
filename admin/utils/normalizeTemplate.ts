import type { Template } from '@/types/template';

/**
 * Recursively unwraps `.data` fields until it hits a layer without `.data`
 */
function unwrapData<T = any>(obj: any): T {
  let current = obj;
  let depth = 0;
  while (current?.data && depth < 10) {
    current = current.data;
    depth++;
  }
  return current;
}

export function normalizeTemplate(entry: any): Template {
  const unwrapped = unwrapData(entry);

  // ✅ Prefer deeply nested unwrapped pages
  const rawPages = unwrapped.pages ?? [];
  const services = entry.services ?? unwrapped.services ?? [];

  const pages = Array.isArray(rawPages)
    ? rawPages.map((page: any, i: number) => ({
        id: page.id || `page-${i}`,
        slug: page.slug || 'home',
        title: page.title || 'Home',
        show_footer: page.show_footer ?? true,
        show_header: page.show_header ?? true,
        content_blocks: Array.isArray(page.content_blocks) ? page.content_blocks : [],
        ...page,
      }))
    : [];

  const rawName = entry.template_name?.trim();
  const rawSlug = entry.slug?.trim();
  const industry = entry.industry?.trim() ?? '';
  const phone = entry.phone ?? '';

  const derivedName = rawName || rawSlug || `new-template-${Math.random().toString(36).slice(2, 6)}`;
  const derivedSlug =
    rawSlug ||
    derivedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .trim();

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
    phone,
    hero_url: entry.hero_url ?? '',
    banner_url: entry.banner_url ?? '',
    logo_url: entry.logo_url ?? '',
    team_url: entry.team_url ?? '',
    is_site: entry.is_site ?? false,
    created_at: entry.created_at ?? new Date().toISOString(),
    updated_at: entry.updated_at ?? new Date().toISOString(),
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
      ...unwrapped,
      services: Array.isArray(services) ? services : [],
      pages,
    },
  };

  // 🚫 Strip legacy top-level pages
  delete (normalized as any).pages;

  return normalized;
}
