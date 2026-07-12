// lib/seo/coach/onPage.ts
//
// Owner-lens on-page SEO extraction from a template's `data` jsonb. Pure, no I/O.
// Reuses analyzeOnPage (schema + page count) and adds the meta/content signals a
// site owner cares about (title/description quality, content depth, H1, alt text).

import { analyzeOnPage } from '@/lib/outreach/onPage';
import type { SiteOnPageSignals } from '@/lib/seo/coach/types';

const THIN_CONTENT_WORDS = 120; // below this, a page reads as a stub to search engines

function collectBlocks(data: any): any[] {
  const out: any[] = [];
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      out.push(b);
      if (Array.isArray(b?.blocks)) out.push(...b.blocks);
    }
  }
  return out;
}

/** Rough visible-word count across a block's string content (recursive). */
function countWords(value: any, depth = 0): number {
  if (depth > 6 || value == null) return 0;
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? t.split(/\s+/).length : 0;
  }
  if (Array.isArray(value)) return value.reduce((n, v) => n + countWords(v, depth + 1), 0);
  if (typeof value === 'object') {
    let n = 0;
    for (const k of Object.keys(value)) {
      // Skip obviously non-prose fields (urls, ids, styling) to avoid inflating the count.
      if (/^(id|src|href|url|image|icon|color|bg|className|type|action|slug)$/i.test(k)) continue;
      n += countWords((value as any)[k], depth + 1);
    }
    return n;
  }
  return 0;
}

function isImageBlock(b: any): boolean {
  const type = String(b?.type || '').toLowerCase();
  if (type.includes('image') || type.includes('gallery')) return true;
  return !!(b?.content?.image || b?.content?.src || b?.content?.imageUrl);
}

function imageHasAlt(b: any): boolean {
  const c = b?.content ?? {};
  return !!(c.alt || c.imageAlt || c.image_alt || c.caption);
}

export function analyzeSiteOnPage(data: any): SiteOnPageSignals {
  const base = analyzeOnPage(data);
  const meta = data?.meta ?? {};
  const blocks = collectBlocks(data);

  const title = String(meta?.title || meta?.seo?.title || data?.business_name || '').trim();
  const description = String(meta?.description || meta?.seo?.description || '').trim();

  const wordCount = blocks.reduce((n, b) => n + countWords(b?.content), 0);

  const hasH1 = blocks.some(
    (b) => String(b?.type || '').toLowerCase() === 'hero' || !!b?.content?.headline || !!b?.content?.title,
  );

  const imageBlocks = blocks.filter(isImageBlock);
  const imagesMissingAlt = imageBlocks.filter((b) => !imageHasAlt(b)).length;

  return {
    pageCount: base.pageCount,
    hasSchema: base.hasLocalBusinessSchema,
    hasTitle: title.length > 0,
    titleLen: title.length,
    hasDescription: description.length > 0,
    descLen: description.length,
    wordCount,
    thinContent: wordCount < THIN_CONTENT_WORDS,
    hasH1,
    imagesMissingAlt,
  };
}
