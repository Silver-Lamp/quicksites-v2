// admin/utils/normalizeTemplate.ts
import type { Template, Page } from '@/types/template';

/**
 * Gracefully handles legacy `.data` wrappers if present
 */
function unwrapLegacyPages(entry: any): any[] {
  if (Array.isArray(entry.pages)) return entry.pages;
  if (entry.data?.pages && Array.isArray(entry.data.pages)) return entry.data.pages;
  return [];
}

function resolveColorMode(entry: any): 'light' | 'dark' | undefined {
  const top = entry?.color_mode;
  const nested = entry?.data?.color_mode;
  if (top === 'light' || top === 'dark') return top;
  if (nested === 'light' || nested === 'dark') return nested;
  // ⚠️ Do NOT invent a default here; callers/UI decide fallback.
  return undefined;
}

export function normalizeTemplate(entry: any): Template {
  const rawPages = unwrapLegacyPages(entry);
  const services = entry.services ?? entry.data?.services ?? [];

  const pages = rawPages.map((page: any, i: number) => {
    const originalBlocks = Array.isArray(page.content_blocks) ? page.content_blocks : [];
    const filteredBlocks = originalBlocks.filter((block: any) => {
      if (!block?.type || !block?.content) return false;
      if (block.type === 'text' && !block.content?.value?.trim()) return false;
      return true;
    });

    const removedCount = originalBlocks.length - filteredBlocks.length;
    if (removedCount > 0) {
      console.log(
        `🧹 normalizeTemplate: Removed ${removedCount} empty block(s) from page "${page.slug || page.title || 'untitled'}"`
      );
    }

    return {
      id: page.id || `page-${i}`,
      slug: page.slug || 'home',
      title: page.title || 'Home',
      show_footer: page.show_footer ?? true,
      show_header: page.show_header ?? true,
      content_blocks: filteredBlocks,
      ...page,
    };
  });

  const rawName = entry.template_name?.trim();
  const rawSlug = entry.slug?.trim();
  const industry = entry.industry?.trim() ?? '';
  const phone = entry.phone ?? entry.data?.phone ?? '';

  const derivedName =
    rawName || rawSlug || `new-template-${Math.random().toString(36).slice(2, 6)}`;
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

  const color_mode = resolveColorMode(entry);

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
    pages: pages as Page[],

    // ✅ Preserve color_mode if provided (no default here)
    ...(color_mode ? { color_mode } : {}),

    meta: {
      title: entry.meta?.title?.trim() || fallbackTitle,
      description: entry.meta?.description?.trim() || fallbackDesc,
      ogImage: entry.meta?.ogImage ?? '',
      faviconSizes: entry.meta?.faviconSizes ?? '',
      appleIcons: entry.meta?.appleIcons ?? '',
      ...entry.meta,
    },
  };

  return normalized;
}
