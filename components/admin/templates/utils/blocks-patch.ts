'use client';

import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';

/* ---------- event helpers ---------- */
function emitApplyPatch(
  patch: Partial<Template>,
  opts?: { persist?: boolean } // default preview-only
) {
  try {
    const detail = { ...(patch as any), __transient: opts?.persist ? false : true };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail }));
  } catch {}
}
function emitMerge(detail: any) {
  try { window.dispatchEvent(new CustomEvent('qs:template:merge', { detail })); } catch {}
}

/* ---------- internals ---------- */
type AnyObj = Record<string, any>;

function getPages(t: Template): AnyObj[] {
  const td = (t as AnyObj)?.data ?? {};
  const pages = td.pages ?? (t as AnyObj)?.pages ?? [];
  return Array.isArray(pages) ? pages : [];
}
function setPagesOnData(t: Template, pages: AnyObj[]): AnyObj {
  const data = { ...((t as AnyObj)?.data ?? {}), pages };
  return data;
}

/** Read/write accessor for the blocks array of a page. */
function getBlocksAccessor(p: AnyObj): {
  kind: 'content_blocks' | 'blocks' | 'content.blocks';
  arr: AnyObj[];
  assign: (page: AnyObj, nextArr: AnyObj[]) => AnyObj;
} {
  if (Array.isArray(p.content_blocks)) {
    return { kind: 'content_blocks', arr: p.content_blocks, assign: (page, next) => ({ ...page, content_blocks: next }) };
  }
  if (Array.isArray(p.blocks)) {
    return { kind: 'blocks', arr: p.blocks, assign: (page, next) => ({ ...page, blocks: next }) };
  }
  if (Array.isArray(p?.content?.blocks)) {
    return { kind: 'content.blocks', arr: p.content.blocks, assign: (page, next) => ({ ...page, content: { ...(page.content ?? {}), blocks: next } }) };
  }
  // default to content.blocks
  return { kind: 'content.blocks', arr: [], assign: (page, next) => ({ ...page, content: { ...(page.content ?? {}), blocks: next } }) };
}

function ensureId(b: AnyObj): AnyObj {
  if (b._id || b.id) return b;
  const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : 'b_' + Math.random().toString(36).slice(2);
  return { _id: id, ...b };
}

/** Resolve which page to edit by id/slug/path OR by numeric index string ("0","1",...). */
function resolvePageIndex(pages: AnyObj[], pageId: string | number): number {
  const idStr = String(pageId);
  // Try semantic id/slug/path first
  const byKey = pages.findIndex(p => String(p.id ?? p.slug ?? p.path ?? '') === idStr);
  if (byKey >= 0) return byKey;
  // Fall back to numeric index
  const n = Number(idStr);
  if (Number.isInteger(n) && n >= 0 && n < pages.length) return n;
  return -1;
}

/* ---------- central ops (return next data & emit events) ---------- */

/** Replace a block by id across all shapes on every page. */
export function replaceBlockEmit(template: Template, updated: Block) {
    const pagesIn = getPages(template);
    const targetId = (updated as any)._id ?? (updated as any).id;
    if (!targetId) return;
  
    let changed = false;
  
    const pagesOut = pagesIn.map((p) => {
      const page = { ...(p as AnyObj) };
  
      // Collect ALL block arrays present on this page
      const arrays: Array<{
        key: 'blocks' | 'content_blocks' | 'content.blocks';
        get: () => AnyObj[];
        set: (next: AnyObj[]) => void;
      }> = [];
  
      if (Array.isArray(page.blocks)) {
        arrays.push({
          key: 'blocks',
          get: () => page.blocks,
          set: (next) => { page.blocks = next; },
        });
      }
      if (Array.isArray(page.content_blocks)) {
        arrays.push({
          key: 'content_blocks',
          get: () => page.content_blocks,
          set: (next) => { page.content_blocks = next; },
        });
      }
      if (Array.isArray(page?.content?.blocks)) {
        arrays.push({
          key: 'content.blocks',
          get: () => page.content.blocks,
          set: (next) => { page.content = { ...(page.content ?? {}), blocks: next }; },
        });
      }
  
      if (!arrays.length) return page;
  
      let touchedThisPage = false;
  
      // Replace the matching id in EVERY array that contains it
      for (const a of arrays) {
        const arr = a.get();
        const idx = arr.findIndex((b: AnyObj) => String(b?._id ?? b?.id) === String(targetId));
        if (idx >= 0) {
          const nextArr = arr.slice();
          nextArr[idx] = updated;
          a.set(nextArr);
          touchedThisPage = true;
        }
      }
  
      if (touchedThisPage) changed = true;
      return page;
    });
  
    if (!changed) return;
  
    const nextData = setPagesOnData(template, pagesOut);
    emitMerge({ data: nextData });
    // preview-only broadcast; toolbar listener will ignore (__transient)
    emitApplyPatch({ data: nextData }, { persist: false });
    return nextData;
  }
  
export function insertBlockEmit(template: Template, pageId: string, block: Block, index?: number) {
  const withId = ensureId(block);
  const pagesIn = getPages(template);

  const target = resolvePageIndex(pagesIn, pageId);
  if (target < 0) return { nextData: setPagesOnData(template, pagesIn), block: withId as Block };

  const pagesOut = pagesIn.map((p, i) => {
    if (i !== target) return p;
    const acc = getBlocksAccessor(p);
    const next = Array.from(acc.arr);
    if (typeof index === 'number' && index >= 0 && index <= next.length) next.splice(index, 0, withId);
    else next.push(withId);
    return acc.assign(p, next);
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData }, { persist: false });
  return { nextData, block: withId as Block };
}

export function removeBlockEmit(template: Template, pageId: string, blockId: string) {
  const pagesIn = getPages(template);
  const target = resolvePageIndex(pagesIn, pageId);
  if (target < 0) return setPagesOnData(template, pagesIn);

  const pagesOut = pagesIn.map((p, i) => {
    if (i !== target) return p;
    const acc = getBlocksAccessor(p);
    const next = acc.arr.filter((b: AnyObj) => (b?._id ?? b?.id) !== blockId);
    return acc.assign(p, next);
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData }, { persist: false });
  return nextData;
}

export function moveBlockEmit(template: Template, pageId: string, blockId: string, toIndex: number) {
  const pagesIn = getPages(template);
  const target = resolvePageIndex(pagesIn, pageId);
  if (target < 0) return setPagesOnData(template, pagesIn);

  const pagesOut = pagesIn.map((p, i) => {
    if (i !== target) return p;
    const acc = getBlocksAccessor(p);
    const from = acc.arr.findIndex((b: AnyObj) => (b?._id ?? b?.id) === blockId);
    if (from < 0) return p;
    const next = Array.from(acc.arr);
    const [item] = next.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, next.length));
    next.splice(clamped, 0, item);
    return acc.assign(p, next);
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData }, { persist: false });
  return nextData;
}

export function setBlocksEmit(template: Template, pageId: string, nextBlocks: Block[]) {
  const pagesIn = getPages(template);
  const target = resolvePageIndex(pagesIn, pageId);
  if (target < 0) return setPagesOnData(template, pagesIn);

  const pagesOut = pagesIn.map((p, i) => {
    if (i !== target) return p;
    const acc = getBlocksAccessor(p);
    return acc.assign(p, nextBlocks.map(ensureId));
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData }, { persist: false });
  return nextData;
}
