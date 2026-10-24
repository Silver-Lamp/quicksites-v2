// lib/editor/moveBlockToPage.ts
//
// Move or copy one block to another page (Amy, 2026-10-23: her "About" copy sat on the Home page
// and there was no way to put it on the About page she had made). A page can hold its blocks in
// `content_blocks`, in `blocks`, or in both as mirrors (CLAUDE.md §8: never edit one copy by path),
// so this rewrites EVERY array a page carries, on both pages. Pure: returns new page objects and
// leaves the input untouched.

type AnyPage = Record<string, any>;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `blk_${Math.random().toString(36).slice(2)}`;

function arraysOf(page: AnyPage): Array<'content_blocks' | 'blocks'> {
  const out: Array<'content_blocks' | 'blocks'> = [];
  if (Array.isArray(page?.content_blocks)) out.push('content_blocks');
  if (Array.isArray(page?.blocks)) out.push('blocks');
  return out;
}

function blockKey(b: any): string {
  return String(b?._id ?? b?.id ?? '');
}

/** A deep copy with fresh ids, so the copy and the original can be edited and deleted separately. */
export function cloneWithNewIds<T>(block: T): T {
  const c: any = JSON.parse(JSON.stringify(block));
  if (c && typeof c === 'object') {
    if ('_id' in c || !('id' in c)) c._id = newId();
    if ('id' in c) c.id = newId();
  }
  return c;
}

export type MoveResult = { pages: AnyPage[]; moved: any } | null;

/**
 * `blockIndex` is the block's position in the source page's primary list (content_blocks if
 * present, else blocks) — the list the canvas renders. Returns null when the move is not possible
 * (same page, bad index).
 */
export function moveBlockToPage(
  pagesIn: AnyPage[],
  fromPageIdx: number,
  blockIndex: number,
  toPageIdx: number,
  mode: 'move' | 'copy',
): MoveResult {
  if (!Array.isArray(pagesIn) || fromPageIdx === toPageIdx) return null;
  const from = pagesIn[fromPageIdx];
  const to = pagesIn[toPageIdx];
  if (!from || !to) return null;

  const fromArrays = arraysOf(from);
  const primary: any[] = fromArrays.length ? from[fromArrays[0]] : from?.content?.blocks ?? [];
  const block = primary[blockIndex];
  if (!block) return null;
  const key = blockKey(block);
  const placed = mode === 'copy' ? cloneWithNewIds(block) : block;

  const nextFrom: AnyPage = { ...from };
  if (mode === 'move') {
    // Remove from every array the source page carries, by id when it has one, else by position.
    for (const k of fromArrays) {
      const arr: any[] = from[k];
      const at = key ? arr.findIndex((b) => blockKey(b) === key) : blockIndex;
      nextFrom[k] = at > -1 ? arr.slice(0, at).concat(arr.slice(at + 1)) : arr.slice();
    }
    if (!fromArrays.length && Array.isArray(from?.content?.blocks)) {
      nextFrom.content = { ...from.content, blocks: from.content.blocks.filter((_: any, i: number) => i !== blockIndex) };
    }
  }

  const nextTo: AnyPage = { ...to };
  const toArrays = arraysOf(to);
  if (toArrays.length) {
    // Same object in both mirrors on the target page, as the page started.
    for (const k of toArrays) nextTo[k] = [...to[k], placed];
  } else if (Array.isArray(to?.content?.blocks)) {
    nextTo.content = { ...to.content, blocks: [...to.content.blocks, placed] };
  } else {
    // A page with no blocks yet: give it both arrays, the shape new pages are created with.
    nextTo.content_blocks = [placed];
    nextTo.blocks = [placed];
  }

  const pages = pagesIn.slice();
  pages[fromPageIdx] = nextFrom;
  pages[toPageIdx] = nextTo;
  return { pages, moved: placed };
}
