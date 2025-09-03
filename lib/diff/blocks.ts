// lib/diff/blocks.ts
import type { Template } from '@/types/template';

export type BlockDiffItem = {
  pageId?: string;
  pageSlug?: string;
  blockId: string;
  fromType?: string;
  toType?: string;
};

export type BlockDiff = {
  added: BlockDiffItem[];
  removed: BlockDiffItem[];
  modified: BlockDiffItem[]; // same id, content or type changed
  addedByType: Record<string, number>;
  removedByType: Record<string, number>;
  modifiedByType: Record<string, number>;
};

type AnyObj = Record<string, any>;

function stableStringify(v: any): string {
  const seen = new WeakSet();
  return JSON.stringify(v, function replacer(_key, value) {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
      const sorted: AnyObj = {};
      for (const k of Object.keys(value).sort()) sorted[k] = (value as AnyObj)[k];
      return sorted;
    }
    return value;
  });
}

function pageList(tmpl: AnyObj | undefined) {
  const pages =
    tmpl?.data?.pages ??
    tmpl?.pages ??
    tmpl?.data?.meta?.pages ??
    [];
  return Array.isArray(pages) ? pages : [];
}

function blockArray(page: AnyObj) {
  const a = page?.content_blocks ?? page?.blocks ?? page?.content?.blocks ?? [];
  return Array.isArray(a) ? a : [];
}

function blockFingerprint(b: AnyObj, idx: number) {
  const id = b._id || b.id || `${idx}-${(b.type || 'unknown')}`;
  const type = String(b.type || b.block_type || 'unknown');
  const { _id, id: _ignoredId, type: _ignoredType, updated_at, created_at, ...rest } = b ?? {};
  const hash = stableStringify(rest);
  return { id, type, hash };
}

export function diffBlocks(prevT: Template | AnyObj | undefined, nextT: Template | AnyObj | undefined): BlockDiff {
  const prevPages = pageList(prevT as AnyObj);
  const nextPages = pageList(nextT as AnyObj);

  type FP = ReturnType<typeof blockFingerprint> & { pageId?: string; pageSlug?: string };
  const prevMap = new Map<string, FP>();
  const nextMap = new Map<string, FP>();

  const putAll = (pages: AnyObj[], target: Map<string, FP>) => {
    for (const p of pages) {
      const pid = String(p.id ?? '');
      const pslug = String(p.slug ?? p.path ?? '');
      const blocks = blockArray(p);
      blocks.forEach((b, i) => {
        const fp = blockFingerprint(b, i);
        target.set(fp.id, { ...fp, pageId: pid || undefined, pageSlug: pslug || undefined });
      });
    }
  };

  putAll(prevPages, prevMap);
  putAll(nextPages, nextMap);

  const added: BlockDiffItem[] = [];
  const removed: BlockDiffItem[] = [];
  const modified: BlockDiffItem[] = [];

  for (const [id, next] of nextMap) {
    if (!prevMap.has(id)) {
      added.push({ pageId: next.pageId, pageSlug: next.pageSlug, blockId: id, toType: next.type });
    } else {
      const prev = prevMap.get(id)!;
      if (prev.type !== next.type || prev.hash !== next.hash) {
        modified.push({
          pageId: next.pageId ?? prev.pageId,
          pageSlug: next.pageSlug ?? prev.pageSlug,
          blockId: id,
          fromType: prev.type,
          toType: next.type,
        });
      }
    }
  }

  for (const [id, prev] of prevMap) {
    if (!nextMap.has(id)) {
      removed.push({ pageId: prev.pageId, pageSlug: prev.pageSlug, blockId: id, fromType: prev.type });
    }
  }

  const addCounts = (items: BlockDiffItem[], pick: 'fromType' | 'toType', acc: Record<string, number>) => {
    for (const it of items) {
      const t = (it[pick] ?? it.fromType ?? it.toType ?? 'unknown') as string;
      acc[t] = (acc[t] ?? 0) + 1;
    }
    return acc;
  };

  return {
    added,
    removed,
    modified,
    addedByType: addCounts(added, 'toType', {}),
    removedByType: addCounts(removed, 'fromType', {}),
    modifiedByType: addCounts(modified, 'toType', {}),
  };
}
