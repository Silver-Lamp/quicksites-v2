// admin/utils/normalizeTemplate.ts
import type { Template, Page } from '@/types/template';

/** Read pages from either legacy top-level or canonical data.pages */
function unwrapLegacyPages(entry: any): any[] {
  if (Array.isArray(entry?.data?.pages)) return entry.data.pages;
  if (Array.isArray(entry?.pages)) return entry.pages;
  return [];
}

function resolveColorMode(entry: any): 'light' | 'dark' | undefined {
  const top = entry?.color_mode;
  const nested = entry?.data?.color_mode;
  if (top === 'light' || top === 'dark') return top;        // top-level wins
  if (nested === 'light' || nested === 'dark') return nested;
  return undefined; // UI decides fallback
}

const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';

/**
 * Hoist a single header/footer from legacy page blocks if needed, and
 * strip any header/footer blocks from all pages (idempotent).
 * NOTE: We intentionally PREFER data.headerBlock/footerBlock over top-level.
 */
function hoistHeaderFooter(
  pagesIn: any[],
  preferredHeader?: any | null,
  preferredFooter?: any | null
) {
  let headerBlock = preferredHeader ?? null;
  let footerBlock = preferredFooter ?? null;

  const pages = (pagesIn ?? []).map((p) => ({
    ...(p || {}),
    content_blocks: [...(p?.content_blocks ?? [])],
  }));

  if (pages.length && (!headerBlock || !footerBlock)) {
    const first = pages[0];
    const nextBlocks: any[] = [];
    for (const b of first.content_blocks ?? []) {
      if (!headerBlock && isHeader(b)) {
        headerBlock = b;
        continue;
      }
      if (!footerBlock && isFooter(b)) {
        footerBlock = b;
        continue;
      }
      nextBlocks.push(b);
    }
    first.content_blocks = nextBlocks;
  }

  const cleanedPages = pages.map((p) => ({
    ...p,
    content_blocks: (p.content_blocks ?? []).filter((b: any) => !isHeader(b) && !isFooter(b)),
  }));

  return { cleanedPages, headerBlock, footerBlock };
}

export function normalizeTemplate(entry: any): Template {
  const rawPages = unwrapLegacyPages(entry);
  const services = entry.services ?? entry.data?.services ?? [];
  const color_mode = resolveColorMode(entry);

  // Prefer chrome from data.* first (DB stores it there), then fall back to root
  const preferredHeader = entry?.data?.headerBlock ?? entry?.headerBlock ?? null;
  const preferredFooter = entry?.data?.footerBlock ?? entry?.footerBlock ?? null;

  // Hoist/strip header/footer as needed based on the preferred values
  const { cleanedPages: hfPages, headerBlock, footerBlock } = hoistHeaderFooter(
    rawPages,
    preferredHeader,
    preferredFooter
  );

  // Normalize pages (filter empties; keep toggles & overrides)
  const pages = (hfPages as any[]).map((page: any, i: number) => {
    const originalBlocks = Array.isArray(page.content_blocks) ? page.content_blocks : [];
    const filteredBlocks = originalBlocks.filter((block: any) => {
      if (!block?.type || !block?.content) return false;
      if (block.type === 'text' && !block.content?.value?.trim()) return false;
      return true;
    });

    // const removedCount = originalBlocks.length - filteredBlocks.length;
    // if (process.env.NODE_ENV !== 'production' && removedCount > 0) {
    //   console.log(
    //     `🧹 normalizeTemplate: Removed ${removedCount} empty block(s) from page "${page.slug || page.title || 'untitled'}"`
    //   );
    // }

    return {
      id: page.id || `page-${i}`,
      slug: page.slug || (i === 0 ? 'home' : `page-${i + 1}`),
      title: page.title || (i === 0 ? 'Home' : `Page ${i + 1}`),
      show_footer: page.show_footer ?? true,
      show_header: page.show_header ?? true,
      headerOverride: page.headerOverride ?? null,
      footerOverride: page.footerOverride ?? null,
      content_blocks: filteredBlocks,
      ...page,
    } as Page;
  });

  // Meta fallbacks
  const rawName = entry.template_name?.trim();
  const rawSlug = entry.slug?.trim();
  const industry = entry.industry?.trim() ?? '';
  const phone = entry.phone ?? entry.data?.phone ?? '';

  const derivedName =
    rawName || rawSlug || `new-template-${Math.random().toString(36).slice(2, 6)}`;
  const derivedSlug =
    rawSlug ||
    derivedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').trim();

  const heroBlock = pages[0]?.content_blocks?.find((b: any) => b.type === 'hero');
  const fallbackTitle = derivedName || heroBlock?.content?.headline || '';
  const fallbackDesc = heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';

  const normalized: Template = {
    id: entry.id,
    owner_id: entry.owner_id ?? '',
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
    created_at: entry.created_at ?? new Date().toISOString(),
    updated_at: entry.updated_at ?? new Date().toISOString(),
    domain: entry.domain ?? '',
    custom_domain: entry.custom_domain ?? '',
    published: entry.published ?? false,
    verified: entry.verified ?? false,
    services: Array.isArray(services) ? services : [],
    phone: entry?.data?.phone ?? phone ?? undefined,
    business_name: entry.business_name || '',
    contact_email: entry.contact_email || '',
    address_line1: entry.address_line1 || '',
    address_line2: entry.address_line2 || '',
    city: entry.city || '',
    state: entry.state || '',
    postal_code: entry.postal_code || '',
    latitude: entry.latitude || '',
    longitude: entry.longitude || '',
    // Keep legacy readers happy
    pages: pages as Page[],

    // Canonical data blob (mirror header/footer here for DB round-trip)
    data: {
      ...(entry.data ?? {}),
      pages: pages as Page[],
      headerBlock: headerBlock ?? null,
      footerBlock: footerBlock ?? null,
      color_mode: entry?.data?.color_mode ?? undefined,
    },

    // Top-level color_mode only if provided (no default invented)
    ...(color_mode ? { color_mode } : {}),

    // Mirror chrome to top-level for runtime
    headerBlock: headerBlock ?? null,
    footerBlock: footerBlock ?? null,

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
