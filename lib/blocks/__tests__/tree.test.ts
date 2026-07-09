import {
  findBlockById, replaceBlockById, hasBlockId, blockId,
  removeBlockById, moveChildById, insertIntoColumn,
} from '@/lib/blocks/tree';

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

describe('removeBlockById', () => {
  it('removes a top-level block', () => {
    const next = removeBlockById(tree(), 'contact');
    expect(hasBlockId(next, 'contact')).toBe(false);
    expect(next.length).toBe(3);
  });
  it('removes a nested section child, leaving the section + other column', () => {
    const next = removeBlockById(tree(), 't1');
    expect(hasBlockId(next, 't1')).toBe(false);
    expect(hasBlockId(next, 't2')).toBe(true);
    expect(findBlockById(next, 'sec')).toBeTruthy();
  });
  it('removes a nested grid child', () => {
    const next = removeBlockById(tree(), 'g1');
    expect(hasBlockId(next, 'g1')).toBe(false);
    expect(findBlockById(next, 'grd')).toBeTruthy();
  });
});

describe('moveChildById', () => {
  it('reorders top-level blocks', () => {
    const next = moveChildById(tree(), 'sec', 'up'); // sec was index 1 → 0
    expect(next.map(blockId)).toEqual(['sec', 'hero', 'grd', 'contact']);
  });
  it('is a no-op at the top bound', () => {
    const next = moveChildById(tree(), 'hero', 'up');
    expect(next.map(blockId)).toEqual(['hero', 'sec', 'grd', 'contact']);
  });
  it('reorders within a grid (multiple children)', () => {
    const t: any[] = [
      { _id: 'grd', type: 'grid', content: { items: [
        { _id: 'a', type: 'text', content: {} },
        { _id: 'b', type: 'text', content: {} },
      ] } },
    ];
    const next = moveChildById(t, 'a', 'down');
    expect(next[0].content.items.map(blockId)).toEqual(['b', 'a']);
  });
});

describe('insertIntoColumn', () => {
  it('appends a block to the given section column', () => {
    const nb = { _id: 'new', type: 'text', content: { value: 'x' } };
    const next = insertIntoColumn(tree(), 'sec', 0, nb);
    const sec = findBlockById(next, 'sec');
    expect(sec.content.columns[0].items.map(blockId)).toEqual(['t1', 'new']);
    expect(sec.content.columns[1].items.map(blockId)).toEqual(['t2']);
  });
});
