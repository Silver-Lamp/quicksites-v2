/**
 * @jest-environment node
 */
// An invalid block must be DROPPED, never converted into visible content.
//
// It used to be replaced with a text block whose value was
// `Invalid block removed: ${JSON.stringify(raw)}` — and that string is CONTENT. It saves with the
// template and publishes. A real site shipped it: a person's entire biography, their email
// address and their home city, rendered as a wall of raw JSON on their own live page, because
// one story section had an empty heading.
//
// Two separate failures in one line. It leaked the owner's data to visitors in a form that reads
// as a crash, and it PERSISTED — a corrupted block that survives a save isn't a warning, it's
// damage. The console already carried the diagnostic; the page never needed to.
import { normalizePageBlocks } from '../normalizePageBlocks';

// A story block with an empty heading — exactly the shape that shipped.
const INVALID_STORY = {
  _id: '0e75e1ad-98d6-4453-9e50-03f127b5c7f4',
  type: 'story',
  content: {
    title: 'About me',
    sections: [
      { heading: 'A bit about Silver Zhao', body: 'Wrote the original app by hand.' },
      // The offender: schema is heading: z.string().min(1)
      { heading: '', body: 'Email: private@example.com — Residence: Shenyang China' },
    ],
  },
};

const VALID_TEXT = { _id: 'keep-me', type: 'text', content: { value: 'Still here.' } };

const pageWith = (blocks: any[]) => ({ id: 'p', slug: 'index', content_blocks: blocks }) as any;

describe('normalizePageBlocks never publishes an invalid block’s contents', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  afterAll(() => warn.mockRestore());

  it('drops the invalid block instead of rendering it', () => {
    const out = normalizePageBlocks(pageWith([INVALID_STORY]));
    expect(out.content_blocks).toHaveLength(0);
  });

  it('never emits the old "Invalid block removed" text', () => {
    const out = normalizePageBlocks(pageWith([INVALID_STORY]));
    expect(JSON.stringify(out)).not.toContain('Invalid block removed');
  });

  // ⚠️ THE ONE THAT MATTERS. The failure wasn't the wording — it was that the owner's private
  // data ended up in page content at all.
  it('leaks none of the block’s data into the page', () => {
    const out = normalizePageBlocks(pageWith([INVALID_STORY]));
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Shenyang');
    expect(serialized).not.toContain('Wrote the original app by hand');
  });

  it('keeps every valid block around it', () => {
    const out = normalizePageBlocks(pageWith([VALID_TEXT, INVALID_STORY, { ...VALID_TEXT, _id: 'two' }]));
    expect(out.content_blocks).toHaveLength(2);
    expect(JSON.stringify(out)).toContain('Still here.');
  });

  it('still reports the drop, so the loss is knowable', () => {
    // Dropping silently would trade a visible bug for an invisible one. The diagnostic moves
    // out of the page and into a channel the owner's editor can surface.
    const dropped: any[] = [];
    normalizePageBlocks(pageWith([INVALID_STORY]), (info) => dropped.push(info));
    expect(dropped).toHaveLength(1);
    expect(dropped[0].type).toBe('story');
  });

  it('warns on the console as well', () => {
    warn.mockClear();
    normalizePageBlocks(pageWith([INVALID_STORY]));
    expect(warn).toHaveBeenCalled();
  });
});
