// lib/site-chrome.ts
import type { Template } from '@/types/template';

type AnyPage = {
  id?: string;
  slug?: string;
  title?: string;
  show_header?: boolean;
  show_footer?: boolean;
  content_blocks?: any[];
};

function pagesOf(site: any): AnyPage[] {
  if (Array.isArray(site?.data?.pages)) return site.data.pages;
  if (Array.isArray(site?.pages)) return site.pages;
  return [];
}

export function getPageBySlug(site: Template, slug?: string): AnyPage | null {
  const pages = pagesOf(site);
  if (!pages.length) return null;
  if (!slug) return pages[0];
  return (
    pages.find((p) => p?.slug === slug || p?.id === slug) ??
    pages[0]
  );
}

export function stripHeaderFooter(blocks: any[] | undefined | null) {
  const arr = Array.isArray(blocks) ? blocks : [];
  return arr.filter((b) => b?.type !== 'header' && b?.type !== 'footer');
}

export function getEffectiveHeader(page: AnyPage | null, site: any) {
  // respect "hide header" on page
  if (page && page.show_header === false) return null;

  // page-level override wins
  const override =
    (page?.content_blocks ?? []).find((b) => b?.type === 'header') ?? null;
  if (override) return override;

  // template-level (support snake & camel & legacy data)
  return site?.header_block ?? site?.headerBlock ?? site?.data?.headerBlock ?? null;
}

export function getEffectiveFooter(page: AnyPage | null, site: any) {
  if (page && page.show_footer === false) return null;

  const override =
    (page?.content_blocks ?? []).find((b) => b?.type === 'footer') ?? null;
  if (override) return override;

  return site?.footer_block ?? site?.footerBlock ?? site?.data?.footerBlock ?? null;
}
