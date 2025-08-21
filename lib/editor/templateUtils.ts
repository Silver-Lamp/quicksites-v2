import type { Template } from '@/types/template';

const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';

export function baseSlug(slug?: string | null) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}
export function randSuffix() {
  const p = () => Math.random().toString(36).slice(2, 6);
  return `${p()}-${p().slice(0, 2)}`;
}

export function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}
function stripHFPage(page: any) {
  const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  return { ...page, content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)) };
}

/** Normalize the Template for saving/snapshotting */
export function normalizeForSnapshot(t: Template, options: { stripChrome?: boolean } = {}): Template {
  const tpl: any = JSON.parse(JSON.stringify(t));
  const pagesIn = getPages(tpl);
  let headerBlock = tpl.headerBlock ?? tpl?.data?.headerBlock ?? null;
  let footerBlock = tpl.footerBlock ?? tpl?.data?.footerBlock ?? null;

  if ((!headerBlock || !footerBlock) && pagesIn.length > 0) {
    const firstBlocks = Array.isArray(pagesIn[0]?.content_blocks) ? pagesIn[0].content_blocks : [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  const cleanedPages = pagesIn.map(stripHFPage);

  tpl.headerBlock = headerBlock ?? null;
  tpl.footerBlock = footerBlock ?? null;
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  const topMode = tpl?.color_mode;
  const nestedMode = tpl?.data?.color_mode;
  if (topMode !== 'light' && topMode !== 'dark' && (nestedMode === 'light' || nestedMode === 'dark')) {
    tpl.color_mode = nestedMode;
  }
  return tpl as Template;
}

export function buildSharedSnapshotPayload(t: Template) {
  const normalized = normalizeForSnapshot(t);
  const templateData = {
    ...(normalized.data ?? {}),
    pages: getPages(normalized),
    headerBlock: normalized.headerBlock ?? null,
    footerBlock: normalized.footerBlock ?? null,
  };
  return { normalized, templateData };
}

/** Small “x ago” label */
export function relativeTimeLabel(dateLike?: string) {
  if (!dateLike) return '';
  const now = Date.now();
  const then = new Date(dateLike).getTime();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
