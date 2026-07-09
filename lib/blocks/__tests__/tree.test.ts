import { findBlockById, replaceBlockById, hasBlockId, blockId } from '@/lib/blocks/tree';

const tree = (): any[] => [
  { _id: 'hero', type: 'hero', content: { headline: 'Hi' } },
  {
    _id: 'sec', type: 'section',
    content: {
      columns: [
        { items: [{ _id: 't1', type: 'text', content: { value: 'left' } }] },
        { items: [{ _id: 't2', type: 'text', content: { value: 'right' } }] },
      ],
    },
  },
  {
    _id: 'grd', type: 'grid',
    content: { items: [{ _id: 'g1', type: 'text', content: { value: 'gridchild' } }] },
  },
  { _id: 'contact', type: 'contact_form', content: {} },
];

describe('findBlockById', () => {
  it('finds top-level, nested-in-section, and nested-in-grid blocks', () => {
    const t = tree();
    expect(findBlockById(t, 'hero')?.type).toBe('hero');
    expect(findBlockById(t, 't1')?.content.value).toBe('left');
    expect(findBlockById(t, 't2')?.content.value).toBe('right');
    expect(findBlockById(t, 'g1')?.content.value).toBe('gridchild');
    expect(findBlockById(t, 'nope')).toBeNull();
  });
});

describe('replaceBlockById', () => {
  it('replaces a nested section child and keeps the rest identical', () => {
    const t = tree();
    const updated = { _id: 't2', type: 'text', content: { value: 'RIGHT!' } };
    const next = replaceBlockById(t, updated);

    expect(findBlockById(next, 't2')?.content.value).toBe('RIGHT!');
    // unrelated blocks keep identity (not needlessly rebuilt)
    expect(next[0]).toBe(t[0]); // hero untouched
    expect(next[3]).toBe(t[3]); // contact untouched
    // the section was rebuilt (new object) but the OTHER column is untouched
    expect(next[1]).not.toBe(t[1]);
    expect(next[1].content.columns[0]).toBe(t[1].content.columns[0]); // left column same ref
    expect(next[1].content.columns[1]).not.toBe(t[1].content.columns[1]); // right column rebuilt
    // original tree unmutated
    expect(t[1].content.columns[1].items[0].content.value).toBe('right');
  });

  it('replaces a nested grid child', () => {
    const t = tree();
    const next = replaceBlockById(t, { _id: 'g1', type: 'text', content: { value: 'G!' } });
    expect(findBlockById(next, 'g1')?.content.value).toBe('G!');
    expect(next[2]).not.toBe(t[2]);
    expect(next[0]).toBe(t[0]);
  });

  it('replaces a top-level block like a flat replace', () => {
    const t = tree();
    const next = replaceBlockById(t, { _id: 'hero', type: 'hero', content: { headline: 'New' } });
    expect(findBlockById(next, 'hero')?.content.headline).toBe('New');
  });

  it('no-ops (returns structurally-equal) when id is absent', () => {
    const t = tree();
    const next = replaceBlockById(t, { _id: 'ghost', type: 'text', content: {} });
    expect(next.map(blockId)).toEqual(t.map(blockId));
    expect(hasBlockId(next, 'ghost')).toBe(false);
  });
});
