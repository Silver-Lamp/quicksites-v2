// A same-origin image path must survive block validation.
//
// ⚠️ THE FAILURE THIS GUARDS IS DESTRUCTIVE, NOT COSMETIC. The hero's `image_url` was
// z.string().url(), which rejects a relative path. Our Places photo proxy stores exactly that
// (/api/public/place-photo?ref=…, so the API key never reaches the browser). When validation
// threw, normalizePageBlocks caught it and REPLACED the hero with a text block reading
// "Invalid block removed: {…}" — so merely OPENING the editor destroyed the hero on seven real
// restaurants' drafts, and autosave would have written that loss back.
//
// It stayed invisible because the published site renders from a snapshot, which kept showing
// the correct hero the whole time. Draft and published disagreeing is the trap this repo keeps
// re-learning; here it hid a data-loss bug.
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import { normalizePageBlocks } from '@/lib/utils/normalizePageBlocks';

const hero = (image_url: string) => ({
  _id: '75956bb6-63c9-4858-b6df-defd6ae2ec64',
  type: 'hero',
  content: { headline: 'Phê', cta_text: 'View Menu', cta_link: '#menu', hide_cta: false, image_url },
});

const PROXY = '/api/public/place-photo?ref=AWCwydi8ZIa2wO1D8wxVFfOxGMb1CwGCJN5siSQrzRt-wmHn78IQ';

describe('hero image_url accepts same-origin paths', () => {
  it('accepts the Places photo proxy path (the exact value that was being destroyed)', () => {
    expect(() => normalizeBlock(hero(PROXY) as any)).not.toThrow();
  });

  it('still accepts an absolute URL', () => {
    expect(() => normalizeBlock(hero('https://example.com/photo.jpg') as any)).not.toThrow();
  });

  it('still accepts empty (no image set)', () => {
    expect(() => normalizeBlock(hero('') as any)).not.toThrow();
  });

  it('still rejects something that is neither — the rule is loosened, not removed', () => {
    expect(() => normalizeBlock(hero('javascript:alert(1)') as any)).toThrow();
  });

  // The end-to-end symptom: the page normalizer must return the hero itself, not a text block
  // apologising for having deleted it.
  it('does NOT replace the hero with an "Invalid block removed" text block', () => {
    const page: any = { id: 'p1', content_blocks: [hero(PROXY)] };
    const out = normalizePageBlocks(page);
    expect(out.content_blocks).toHaveLength(1);
    expect((out.content_blocks[0] as any).type).toBe('hero');
    expect(JSON.stringify(out)).not.toContain('Invalid block removed');
  });
});
