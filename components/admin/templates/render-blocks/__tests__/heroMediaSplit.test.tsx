// The hero's `media_split` layout — the B Hard header made a standard option (2026-10-16):
// small image + h1 + CTA beside up to three tilted media cards; inline when there is no media.
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import HeroBlock from '@/components/admin/templates/render-blocks/hero';
import { heroHasMedia, parseHeroMedia } from '@/lib/sites/heroMedia';
import { HERO_MODES, heroModeFromLayout, heroModesFor } from '@/lib/theme/shuffleOptions';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';

jest.mock('@/hooks/useSafeScroll', () => ({ useSafeScroll: () => ({ y: null }) }));

const media = [
  { kind: 'video', url: 'https://x.test/a.mp4', poster: 'https://x.test/a.jpg', caption: 'A' },
  { kind: 'image', url: 'https://x.test/b.jpg', caption: 'B' },
];
const content = { headline: 'B Hard', subheadline: 'Five tablets.', cta_text: 'Get notified', cta_link: '#contact', image_url: 'https://x.test/tin.webp', layout_mode: 'media_split', media, media_heading: 'Ok, now that’s new!' };
const block = (c: Record<string, unknown>) => ({ type: 'hero', _id: 'h1', content: c } as any);

describe('hero media_split', () => {
  it('renders the two-column layout: small image, h1, CTA, eyebrow, tilted cards (video + image)', () => {
    const { container } = render(<HeroBlock block={block(content)} template={{ data: { meta: {} } } as any} />);
    expect(container.querySelector('[data-hero-layout="media_split"]')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('B Hard');
    expect(container.querySelector('h2')?.textContent).toBe('Ok, now that’s new!');
    expect(container.querySelector('img[src="https://x.test/tin.webp"]')?.className).toMatch(/max-w-\[260px\]/);
    const cards = Array.from(container.querySelectorAll('[data-tilted]'));
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.getAttribute('data-tilted'))).toEqual(['1', '1']);
    expect(container.querySelector('video')?.getAttribute('poster')).toBe('https://x.test/a.jpg');
    expect(container.querySelector('video')?.getAttribute('preload')).toBe('none');
    expect(container.querySelector('img[src="https://x.test/b.jpg"]')).not.toBeNull();
    const cta = container.querySelector('a[href="#contact"]');
    expect(cta?.textContent).toContain('Get notified');
  });
  it('a card straightens when its video plays', () => {
    const { container } = render(<HeroBlock block={block(content)} template={{ data: { meta: {} } } as any} />);
    fireEvent.play(container.querySelector('video')!);
    expect(container.querySelectorAll('[data-tilted]')[0].getAttribute('data-tilted')).toBe('0');
  });
  it('a picture card with title/text is a button that surfaces the text on tap and straightens; a plain picture is just a picture (Katie Bee, 2026-10-19)', () => {
    const withText = [
      { kind: 'image', url: 'https://x.test/pantry.jpg', title: 'Home', text: 'I love helping people bring more peace and clarity to their homes.' },
      { kind: 'image', url: 'https://x.test/plain.jpg', caption: 'Plain' },
    ];
    const { container } = render(<HeroBlock block={block({ ...content, media: withText })} template={{ data: { meta: {} } } as any} />);
    const btn = container.querySelector('button[data-media-reveal]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('data-media-reveal')).toBe('closed');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    // the plain card has no button and no cue
    expect(container.querySelectorAll('button[data-media-reveal]')).toHaveLength(1);
    expect(container.querySelector('img[src="https://x.test/plain.jpg"]')?.closest('button')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('data-media-reveal')).toBe('open');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent).toContain('I love helping people bring more peace and clarity to their homes.');
    expect(btn.closest('[data-tilted]')?.getAttribute('data-tilted')).toBe('0'); // straightens while open
    fireEvent.click(btn);
    expect(btn.getAttribute('data-media-reveal')).toBe('closed');
    expect(btn.closest('[data-tilted]')?.getAttribute('data-tilted')).toBe('1');
    // parse + schema carry the fields
    expect(parseHeroMedia({ media: withText })[0]).toMatchObject({ kind: 'image', title: 'Home' });
    expect((blockContentSchemaMap as any).hero.schema.safeParse({ ...content, media: withText }).success).toBe(true);
  });
  it('without media it falls back to the inline hero rather than an empty second column', () => {
    const { container } = render(<HeroBlock block={block({ ...content, media: [] })} template={{ data: { meta: {} } } as any} />);
    expect(container.querySelector('[data-hero-layout="media_split"]')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('B Hard');
  });
});

describe('heroMedia helpers, schema, shuffle', () => {
  it('parseHeroMedia keeps https items, infers image from the extension, caps at three', () => {
    const r = parseHeroMedia({ media: [{ url: 'javascript:x' }, { url: 'https://x.test/p.png' }, { url: 'https://x.test/v.mp4', poster: 'nope' }, { url: 'https://x.test/2.mp4' }, { url: 'https://x.test/3.mp4' }] });
    expect(r.map((m) => m.kind)).toEqual(['image', 'video', 'video']);
    expect(r[1].poster).toBeUndefined();
    expect(heroHasMedia({ pages: [{ blocks: [{ type: 'hero', content: { media } }] }] })).toBe(true);
    expect(heroHasMedia({ pages: [{ blocks: [{ type: 'hero', content: {} }] }] })).toBe(false);
  });
  it('the schema accepts media_split + media; the default validates', () => {
    const schema = (blockContentSchemaMap as any).hero.schema;
    expect(schema.safeParse(content).success).toBe(true);
    expect(schema.safeParse({ ...content, media: Array(4).fill(media[0]) }).success).toBe(false);
    expect(schema.safeParse((DEFAULT_BLOCK_CONTENT as any).hero).success).toBe(true);
  });
  it('Shuffle offers media_split only when the hero has media, and a media_split theme maps to inline without it', () => {
    expect(HERO_MODES).toContain('media_split');
    expect(heroModesFor(false)).not.toContain('media_split');
    expect(heroModesFor(true)).toContain('media_split');
    expect(heroModeFromLayout('media_split', false)).toBe('inline');
    expect(heroModeFromLayout('media_split', true)).toBe('media_split');
  });
});
