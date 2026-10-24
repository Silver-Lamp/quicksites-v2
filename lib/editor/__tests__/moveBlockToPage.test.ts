/**
 * @jest-environment node
 */
import { moveBlockToPage } from '@/lib/editor/moveBlockToPage';

const blk = (id: string) => ({ _id: id, type: 'text', content: { html: id } });
const mirrored = (ids: string[]) => {
  const arr = ids.map(blk);
  return { content_blocks: arr, blocks: arr };
};

it('a move takes the block off BOTH arrays of the source page and adds it to both of the target', () => {
  const pages = [{ slug: 'index', ...mirrored(['a', 'b', 'c']) }, { slug: 'about', ...mirrored(['x']) }];
  const r = moveBlockToPage(pages, 0, 1, 1, 'move')!;
  expect(r.pages[0].content_blocks.map((b: any) => b._id)).toEqual(['a', 'c']);
  expect(r.pages[0].blocks.map((b: any) => b._id)).toEqual(['a', 'c']);
  expect(r.pages[1].content_blocks.map((b: any) => b._id)).toEqual(['x', 'b']);
  expect(r.pages[1].blocks.map((b: any) => b._id)).toEqual(['x', 'b']);
  expect(pages[0].content_blocks).toHaveLength(3); // input untouched
});

it('a copy leaves the original and adds a copy with a new id', () => {
  const pages = [{ slug: 'index', ...mirrored(['a']) }, { slug: 'about', content_blocks: [] }];
  const r = moveBlockToPage(pages, 0, 0, 1, 'copy')!;
  expect(r.pages[0].content_blocks).toHaveLength(1);
  expect(r.pages[1].content_blocks).toHaveLength(1);
  expect(r.pages[1].content_blocks[0]._id).not.toBe('a');
  expect(r.pages[1].content_blocks[0].content.html).toBe('a');
});

it('an empty target page gets both arrays; a same-page or out-of-range move is refused', () => {
  const pages = [{ slug: 'index', ...mirrored(['a']) }, { slug: 'new-page' }];
  const r = moveBlockToPage(pages, 0, 0, 1, 'move')!;
  expect(r.pages[1].content_blocks).toHaveLength(1);
  expect(r.pages[1].blocks).toHaveLength(1);
  expect(moveBlockToPage(pages, 0, 0, 0, 'move')).toBeNull();
  expect(moveBlockToPage(pages, 0, 5, 1, 'move')).toBeNull();
});
