// Unit tests for the pure half of the last mile: pointing a site's `about_that` player at a
// connected embed. No I/O — attachEmbedToSite()'s load/commit wrapper is covered by the route.

import { setAboutThatEmbed } from '../attachEmbedToSite';

const EMBED = '6f9c1b2a-3d4e-5f60-7a8b-9c0d1e2f3a4b';
const OTHER = '11111111-2222-3333-4444-555555555555';

const withBlocks = (blocks: any[]) => ({ pages: [{ content_blocks: blocks }] });

describe('setAboutThatEmbed', () => {
  it('fills an existing about_that block that has no embed yet', () => {
    const res = setAboutThatEmbed(withBlocks([{ type: 'hero' }, { type: 'about_that', content: { embed_id: '' } }]), EMBED);
    expect(res.action).toBe('updated');
    expect(res.changed).toBe(true);
    expect(res.data.pages[0].content_blocks[1].content.embed_id).toBe(EMBED);
  });

  it('re-points a block that was on a different embed', () => {
    const res = setAboutThatEmbed(withBlocks([{ type: 'about_that', content: { embed_id: OTHER, width: '480' } }]), EMBED);
    expect(res.action).toBe('updated');
    expect(res.data.pages[0].content_blocks[0].content.embed_id).toBe(EMBED);
    // Other player settings survive the re-point.
    expect(res.data.pages[0].content_blocks[0].content.width).toBe('480');
  });

  it('is idempotent when the block already plays this embed', () => {
    const data = withBlocks([{ type: 'about_that', content: { embed_id: EMBED } }]);
    const res = setAboutThatEmbed(data, EMBED);
    expect(res.action).toBe('noop');
    expect(res.changed).toBe(false);
    expect(res.data).toBe(data); // untouched, not a clone
  });

  it('does NOT add a block unless insertIfMissing is set', () => {
    const res = setAboutThatEmbed(withBlocks([{ type: 'hero' }]), EMBED);
    expect(res.action).toBe('noop');
    expect(res.changed).toBe(false);
  });

  it('appends a player when asked, writing both block fields', () => {
    const res = setAboutThatEmbed(withBlocks([{ type: 'hero' }]), EMBED, { insertIfMissing: true });
    expect(res.action).toBe('inserted');
    const page = res.data.pages[0];
    expect(page.content_blocks).toHaveLength(2);
    expect(page.content_blocks[1].type).toBe('about_that');
    expect(page.content_blocks[1].content.embed_id).toBe(EMBED);
    // Canonical + legacy readers must agree.
    expect(page.blocks).toBe(page.content_blocks);
  });

  it('handles an empty template (no pages) when inserting', () => {
    const res = setAboutThatEmbed({}, EMBED, { insertIfMissing: true });
    expect(res.action).toBe('inserted');
    expect(res.data.pages[0].content_blocks[0].content.embed_id).toBe(EMBED);
  });

  it('finds a nested about_that block (one level down)', () => {
    const res = setAboutThatEmbed(
      { pages: [{ content_blocks: [{ type: 'grid', content_blocks: [{ type: 'about_that', content: {} }] }] }] },
      EMBED,
    );
    expect(res.action).toBe('updated');
    expect(res.data.pages[0].content_blocks[0].content_blocks[0].content.embed_id).toBe(EMBED);
  });

  it('reads the legacy `blocks` array too', () => {
    const res = setAboutThatEmbed({ pages: [{ blocks: [{ type: 'about_that', content: {} }] }] }, EMBED);
    expect(res.action).toBe('updated');
    expect(res.data.pages[0].blocks[0].content.embed_id).toBe(EMBED);
  });

  it('ignores a blank embed id', () => {
    const res = setAboutThatEmbed(withBlocks([{ type: 'about_that', content: {} }]), '   ');
    expect(res.action).toBe('noop');
    expect(res.changed).toBe(false);
  });
});
