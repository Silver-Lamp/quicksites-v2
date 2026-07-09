// lib/blocks/tree.ts
//
// Recursive block-tree helpers keyed by _id — descend into container blocks
// (`section` columns[].items, `grid` content.items) so a nested child can be
// found and replaced by id. Used by the editor so editing/saving a block inside
// a section works (L4.1; see docs/LAYOUT_L4_PLAN.md). For flat (non-nested)
// trees these behave exactly like a flat find/replace.

type AnyBlock = any;

export const blockId = (b: AnyBlock): string => String(b?._id ?? b?.id ?? '');

/** Raw child arrays a container block holds (for read/recurse). */
function childArrays(block: AnyBlock): AnyBlock[][] {
  const c = block?.content ?? {};
  if (block?.type === 'grid' && Array.isArray(c.items)) return [c.items];
  if (block?.type === 'section' && Array.isArray(c.columns)) {
    return c.columns.map((col: any) => (Array.isArray(col?.items) ? col.items : [])).filter((a: any[]) => a.length);
  }
  return [];
}

/** Find a block by id anywhere in the tree (top-level or nested in a container). */
export function findBlockById(blocks: AnyBlock[], id: string): AnyBlock | null {
  if (!Array.isArray(blocks) || !id) return null;
  for (const b of blocks) {
    if (blockId(b) === id) return b;
    for (const arr of childArrays(b)) {
      const found = findBlockById(arr, id);
      if (found) return found;
    }
  }
  return null;
}

/** True if `id` exists anywhere in the tree. */
export function hasBlockId(blocks: AnyBlock[], id: string): boolean {
  return !!findBlockById(blocks, id);
}

/**
 * Return a new blocks array with the block matching `updated`'s id replaced,
 * descending into container children. Only rebuilds container objects that
 * actually contain the id, so unrelated blocks keep their identity.
 */
export function replaceBlockById(blocks: AnyBlock[], updated: AnyBlock): AnyBlock[] {
  const id = blockId(updated);
  if (!Array.isArray(blocks) || !id) return blocks;
  return blocks.map((b) => {
    if (blockId(b) === id) return updated;

    if (b?.type === 'grid' && Array.isArray(b?.content?.items)) {
      if (!hasBlockId(b.content.items, id)) return b;
      return { ...b, content: { ...b.content, items: replaceBlockById(b.content.items, updated) } };
    }

    if (b?.type === 'section' && Array.isArray(b?.content?.columns)) {
      if (!b.content.columns.some((col: any) => Array.isArray(col?.items) && hasBlockId(col.items, id))) return b;
      return {
        ...b,
        content: {
          ...b.content,
          columns: b.content.columns.map((col: any) =>
            Array.isArray(col?.items) && hasBlockId(col.items, id)
              ? { ...col, items: replaceBlockById(col.items, updated) }
              : col,
          ),
        },
      };
    }

    return b;
  });
}

/** Remove a block by id anywhere in the tree (top-level or nested in a container). */
export function removeBlockById(blocks: AnyBlock[], id: string): AnyBlock[] {
  if (!Array.isArray(blocks) || !id) return blocks;
  const out: AnyBlock[] = [];
  for (const b of blocks) {
    if (blockId(b) === id) continue; // drop it
    if (b?.type === 'grid' && Array.isArray(b?.content?.items) && hasBlockId(b.content.items, id)) {
      out.push({ ...b, content: { ...b.content, items: removeBlockById(b.content.items, id) } });
    } else if (
      b?.type === 'section' &&
      Array.isArray(b?.content?.columns) &&
      b.content.columns.some((col: any) => Array.isArray(col?.items) && hasBlockId(col.items, id))
    ) {
      out.push({
        ...b,
        content: {
          ...b.content,
          columns: b.content.columns.map((col: any) =>
            Array.isArray(col?.items) && hasBlockId(col.items, id)
              ? { ...col, items: removeBlockById(col.items, id) }
              : col,
          ),
        },
      });
    } else {
      out.push(b);
    }
  }
  return out;
}

/** Swap the block with `id` toward its neighbor in the SAME array, if possible. */
function reorderInArray(arr: AnyBlock[], id: string, dir: 'up' | 'down'): AnyBlock[] | null {
  const i = arr.findIndex((b) => blockId(b) === id);
  if (i < 0) return null;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= arr.length) return arr; // at a bound → handled, no change
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Move a block up/down within its immediate parent array (top-level or a container column). */
export function moveChildById(blocks: AnyBlock[], id: string, dir: 'up' | 'down'): AnyBlock[] {
  if (!Array.isArray(blocks) || !id) return blocks;
  const top = reorderInArray(blocks, id, dir);
  if (top) return top;
  return blocks.map((b) => {
    if (b?.type === 'grid' && Array.isArray(b?.content?.items) && hasBlockId(b.content.items, id)) {
      const r = reorderInArray(b.content.items, id, dir);
      return r ? { ...b, content: { ...b.content, items: r } } : b;
    }
    if (b?.type === 'section' && Array.isArray(b?.content?.columns)) {
      let changed = false;
      const columns = b.content.columns.map((col: any) => {
        if (Array.isArray(col?.items) && hasBlockId(col.items, id)) {
          const r = reorderInArray(col.items, id, dir);
          if (r) {
            changed = true;
            return { ...col, items: r };
          }
        }
        return col;
      });
      return changed ? { ...b, content: { ...b.content, columns } } : b;
    }
    return b;
  });
}

/**
 * Move a block to the next/prev sibling column within its section (wrapping),
 * appending it to the target column. A non-drag alternative to cross-container DnD.
 */
export function moveChildAcrossColumns(blocks: AnyBlock[], id: string, dir: 'next' | 'prev'): AnyBlock[] {
  if (!Array.isArray(blocks) || !id) return blocks;
  return blocks.map((b) => {
    if (b?.type !== 'section' || !Array.isArray(b?.content?.columns)) return b;
    const cols: AnyBlock[] = b.content.columns;
    if (cols.length < 2) return b;
    const srcIdx = cols.findIndex((col) => Array.isArray(col?.items) && col.items.some((it: AnyBlock) => blockId(it) === id));
    if (srcIdx < 0) return b;
    const child = cols[srcIdx].items.find((it: AnyBlock) => blockId(it) === id);
    const tgtIdx = dir === 'next' ? (srcIdx + 1) % cols.length : (srcIdx - 1 + cols.length) % cols.length;
    const columns = cols.map((col, i) => {
      if (i === srcIdx) return { ...col, items: col.items.filter((it: AnyBlock) => blockId(it) !== id) };
      if (i === tgtIdx) return { ...col, items: [...(Array.isArray(col.items) ? col.items : []), child] };
      return col;
    });
    return { ...b, content: { ...b.content, columns } };
  });
}

/**
 * Move a child within a section to a target column, optionally before a specific
 * sibling (`beforeId`); appends when `beforeId` is absent/not found. Removes it
 * from its source column first. Powers drag-and-drop between columns (L4.2b).
 */
export function moveChildToColumn(
  blocks: AnyBlock[],
  id: string,
  sectionId: string,
  targetColIdx: number,
  beforeId?: string,
): AnyBlock[] {
  if (!Array.isArray(blocks) || !id || !sectionId || beforeId === id) return blocks;
  return blocks.map((b) => {
    if (blockId(b) !== sectionId || b?.type !== 'section' || !Array.isArray(b?.content?.columns)) return b;
    const cols: AnyBlock[] = b.content.columns;
    let child: AnyBlock | null = null;
    for (const col of cols) {
      const f = Array.isArray(col?.items) ? col.items.find((it: AnyBlock) => blockId(it) === id) : undefined;
      if (f) { child = f; break; }
    }
    if (!child) return b;
    const columns = cols.map((col, i) => {
      let items: AnyBlock[] = Array.isArray(col?.items) ? col.items.filter((it: AnyBlock) => blockId(it) !== id) : [];
      if (i === targetColIdx) {
        const at = beforeId ? items.findIndex((it) => blockId(it) === beforeId) : -1;
        if (at >= 0) items = [...items.slice(0, at), child, ...items.slice(at)];
        else items = [...items, child];
      }
      return { ...col, items };
    });
    return { ...b, content: { ...b.content, columns } };
  });
}

/** Insert a block into a section's column (by section id + column index). */
export function insertIntoColumn(
  blocks: AnyBlock[],
  sectionId: string,
  colIdx: number,
  block: AnyBlock,
  atIndex?: number,
): AnyBlock[] {
  if (!Array.isArray(blocks) || !sectionId) return blocks;
  return blocks.map((b) => {
    if (blockId(b) === sectionId && b?.type === 'section' && Array.isArray(b?.content?.columns)) {
      const columns = b.content.columns.map((col: any, i: number) => {
        if (i !== colIdx) return col;
        const items = Array.isArray(col?.items) ? col.items.slice() : [];
        const at = typeof atIndex === 'number' && atIndex >= 0 && atIndex <= items.length ? atIndex : items.length;
        items.splice(at, 0, block);
        return { ...col, items };
      });
      return { ...b, content: { ...b.content, columns } };
    }
    return b;
  });
}
