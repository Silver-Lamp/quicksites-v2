import type { Template } from '@/types/template';

export function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}

export function withSyncedPages(tpl: Template): Template {
  const pages = getPages(tpl);
  return {
    ...tpl,
    pages, // legacy readers
    data: { ...(tpl.data ?? {}), pages }, // canonical
  } as Template;
}

export function getEffectiveHeader(page: any, template: any) {
  if (page?.show_header === false) return null;
  return page?.headerOverride ?? template?.headerBlock ?? null;
}

export function getEffectiveFooter(page: any, template: any) {
  if (page?.show_footer === false) return null;
  return page?.footerOverride ?? template?.footerBlock ?? null;
}

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
