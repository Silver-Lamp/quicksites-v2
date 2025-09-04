'use client';

import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';

/* ---------- event helpers ---------- */
function emitApplyPatch(patch: Partial<Template>) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  } catch {}
}
function emitMerge(detail: any) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:merge', { detail }));
  } catch {}
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

function findBlocksArray(p: AnyObj): { key: 'content_blocks' | 'blocks'; arr: AnyObj[] } {
  if (Array.isArray(p.content_blocks)) return { key: 'content_blocks', arr: p.content_blocks };
  if (Array.isArray(p.blocks)) return { key: 'blocks', arr: p.blocks };
  return { key: 'content_blocks', arr: [] };
}

function ensureId(b: AnyObj): AnyObj {
  if (b._id || b.id) return b;
  const id = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'b_' + Math.random().toString(36).slice(2);
  return { _id: id, ...b };
}

/* ---------- central ops (return next data & emit events) ---------- */

/** Replace a block by id across all pages. */
export function replaceBlockEmit(template: Template, updated: Block) {
  const pagesIn = getPages(template);
  const targetId = (updated as any)._id ?? (updated as any).id;
  if (!targetId) return;

  let changed = false;
  const pagesOut = pagesIn.map((p) => {
    const { key, arr } = findBlocksArray(p);
    if (!arr.length) return p;
    let touched = false;
    const next = arr.map((b) => {
      const bid = b?._id ?? b?.id;
      if (bid && bid === targetId) {
        touched = true;
        changed = true;
        return updated;
      }
      return b;
    });
    return touched ? { ...p, [key]: next } : p;
  });

  if (!changed) return;

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData });
  return nextData;
}

/** Insert a block at index (append if index undefined). Returns new block with id. */
export function insertBlockEmit(
  template: Template,
  pageId: string,
  block: Block,
  index?: number
) {
  const withId = ensureId(block);
  const pagesIn = getPages(template);

  const pagesOut = pagesIn.map((p) => {
    const pid = String(p.id ?? p.slug ?? p.path ?? '');
    if (pid !== String(pageId)) return p;
    const { key, arr } = findBlocksArray(p);
    const next = Array.from(arr);
    if (typeof index === 'number' && index >= 0 && index <= next.length) {
      next.splice(index, 0, withId);
    } else {
      next.push(withId);
    }
    return { ...p, [key]: next };
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData });
  return { nextData, block: withId as Block };
}

/** Remove a block by id. */
export function removeBlockEmit(template: Template, pageId: string, blockId: string) {
  const pagesIn = getPages(template);

  const pagesOut = pagesIn.map((p) => {
    const pid = String(p.id ?? p.slug ?? p.path ?? '');
    if (pid !== String(pageId)) return p;
    const { key, arr } = findBlocksArray(p);
    const next = arr.filter((b) => (b?._id ?? b?.id) !== blockId);
    return { ...p, [key]: next };
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData });
  return nextData;
}

/** Move a block within a page to a new index. */
export function moveBlockEmit(template: Template, pageId: string, blockId: string, toIndex: number) {
  const pagesIn = getPages(template);

  const pagesOut = pagesIn.map((p) => {
    const pid = String(p.id ?? p.slug ?? p.path ?? '');
    if (pid !== String(pageId)) return p;
    const { key, arr } = findBlocksArray(p);
    const idx = arr.findIndex((b) => (b?._id ?? b?.id) === blockId);
    if (idx < 0) return p;
    const next = Array.from(arr);
    const [item] = next.splice(idx, 1);
    const clamped = Math.max(0, Math.min(toIndex, next.length));
    next.splice(clamped, 0, item);
    return { ...p, [key]: next };
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData });
  return nextData;
}

/** Replace the entire blocks array for a page (rare, but handy). */
export function setBlocksEmit(template: Template, pageId: string, nextBlocks: Block[]) {
  const pagesIn = getPages(template);

  const pagesOut = pagesIn.map((p) => {
    const pid = String(p.id ?? p.slug ?? p.path ?? '');
    if (pid !== String(pageId)) return p;
    const { key } = findBlocksArray(p);
    return { ...p, [key]: nextBlocks.map(ensureId) };
  });

  const nextData = setPagesOnData(template, pagesOut);
  emitMerge({ data: nextData });
  emitApplyPatch({ data: nextData });
  return nextData;
}
