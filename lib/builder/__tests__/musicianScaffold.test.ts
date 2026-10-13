/**
 * @jest-environment node
 */
// The musician scaffold (2026-10-13): player → releases → shows → photos → contact, all seeded
// EMPTY, because a show or a release we made up is a false claim under a real artist's name.
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';

const starter: any = buildIndustryStarter({ businessName: 'The Harbor Lights', industryKey: 'musician' });
const blocks: any[] = starter.data.pages[0].blocks;
const types = blocks.map((b) => b.type);

describe('musician scaffold', () => {
  it('leads with the player, then releases, shows, photos, contact — no services, faq or testimonials', () => {
    expect(types).toEqual(['hero', 'perfect_loops_player', 'selected_work', 'events', 'gallery', 'contact_form']);
  });
  it('invents nothing: every list is empty and the events default placeholder is gone', () => {
    expect(blocks.find((b) => b.type === 'events').content.events).toEqual([]);
    expect(blocks.find((b) => b.type === 'events').content.title).toBe('Shows');
    expect(blocks.find((b) => b.type === 'selected_work').content.title).toBe('Releases');
    expect(blocks.find((b) => b.type === 'selected_work').content.items).toEqual([]);
    expect(blocks.find((b) => b.type === 'gallery').content.images).toEqual([]);
    expect(blocks.find((b) => b.type === 'perfect_loops_player').content.embed_url).toBe('');
    expect(JSON.stringify(starter.data)).not.toMatch(/Licensed|insured|free quote|24\/7/i);
  });
  it('the hero asks to listen, and the player section carries that anchor', () => {
    expect(blocks[0].content.cta_link).toBe('#listen');
    expect(blocks[0].content.cta_text).toBe('Listen');
  });
});
