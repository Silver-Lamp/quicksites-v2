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
