// lib/site-chrome.ts
export function getPages(tpl: any) {
    const dataPages = tpl?.data?.pages;
    const rootPages = tpl?.pages;
    if (Array.isArray(dataPages)) return dataPages;
    if (Array.isArray(rootPages)) return rootPages;
    return [];
  }
  
  export function getPageBySlug(tpl: any, slug: string | undefined) {
    const pages = getPages(tpl);
    if (!pages.length) return null;
    if (!slug) return pages[0];
    return pages.find((p: any) => p.slug === slug) ?? pages[0];
  }
  
  // Effective header/footer given page toggles + optional per-page overrides
  export function getEffectiveHeader(page: any, tpl: any) {
    if (!page) return null;
    if (page.show_header === false) return null;
    return page.headerOverride ?? tpl?.headerBlock ?? null;
  }
  
  export function getEffectiveFooter(page: any, tpl: any) {
    if (!page) return null;
    if (page.show_footer === false) return null;
    return page.footerOverride ?? tpl?.footerBlock ?? null;
  }
  