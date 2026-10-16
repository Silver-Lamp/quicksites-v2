// The video showcase: tilted portrait cards over the hero that straighten when played; nothing in
// public when empty. Built for the B Hard commercials (2026-10-16).
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import RenderVideoShowcase, { readShowcaseVideos } from '@/components/admin/templates/render-blocks/video-showcase';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';

const two = {
  heading: 'Ok, now that’s new!',
  videos: [
    { url: 'https://x.test/a.mp4', poster: 'https://x.test/a.jpg', caption: 'A' },
    { url: 'https://x.test/b.mp4', poster: 'https://x.test/b.jpg', caption: 'B' },
  ],
};

describe('video_showcase', () => {
  it('empty → nothing in public, a hint in the editor', () => {
    const pub = render(<RenderVideoShowcase content={{ videos: [] } as any} />);
    expect(pub.container.innerHTML).toBe('');
    const ed = render(<RenderVideoShowcase content={{ videos: [] } as any} previewOnly />);
    expect(ed.container.textContent).toMatch(/Video showcase/);
    expect(ed.container.querySelector('video')).toBeNull();
  });

  it('renders the heading and one tilted card per video, poster + playsinline + preload none', () => {
    const { container } = render(<RenderVideoShowcase content={two as any} />);
    expect(container.querySelector('h2')?.textContent).toBe('Ok, now that’s new!');
    const videos = Array.from(container.querySelectorAll('video'));
    expect(videos).toHaveLength(2);
    for (const v of videos) {
      expect(v.getAttribute('poster')).toMatch(/^https:\/\/x\.test\//);
      expect(v.hasAttribute('playsinline')).toBe(true);
      expect(v.getAttribute('preload')).toBe('none');
    }
    const cards = Array.from(container.querySelectorAll('[data-tilted]'));
    expect(cards.map((c) => c.getAttribute('data-tilted'))).toEqual(['1', '1']);
    expect(cards[0].className).toMatch(/-rotate-3/);
    expect(cards[1].className).toMatch(/\brotate-2\b/);
  });

  it('a card straightens when its video plays and tilts again when it ends', () => {
    const { container } = render(<RenderVideoShowcase content={two as any} />);
    const [v0] = Array.from(container.querySelectorAll('video'));
    fireEvent.play(v0);
    const cards = Array.from(container.querySelectorAll('[data-tilted]'));
    expect(cards[0].getAttribute('data-tilted')).toBe('0');
    expect(cards[0].className).toMatch(/\brotate-0\b/);
    expect(cards[1].getAttribute('data-tilted')).toBe('1');
    fireEvent.ended(v0);
    expect(container.querySelectorAll('[data-tilted]')[0].getAttribute('data-tilted')).toBe('1');
  });

  it('tilt:false and overlap:false are honoured', () => {
    const { container } = render(<RenderVideoShowcase content={{ ...two, tilt: false, overlap: false } as any} />);
    expect(container.querySelector('[data-tilted]')?.getAttribute('data-tilted')).toBe('0');
    expect(container.querySelector('section')?.className).toMatch(/py-10/);
    expect(container.querySelector('section')?.className).not.toMatch(/-mt-/);
  });

  it('readShowcaseVideos drops non-https urls, caps at three, and ignores a bad poster', () => {
    const r = readShowcaseVideos({ videos: [{ url: 'javascript:alert(1)' }, { url: 'https://x.test/1.mp4', poster: 'nope' }, { url: 'https://x.test/2.mp4' }, { url: 'https://x.test/3.mp4' }, { url: 'https://x.test/4.mp4' }] });
    expect(r.map((v) => v.url)).toEqual(['https://x.test/1.mp4', 'https://x.test/2.mp4', 'https://x.test/3.mp4']);
    expect(r[0].poster).toBeUndefined();
  });

  it('hero mode: small product image + h1 + subheadline + 44px button beside the phones; heading becomes the eyebrow', () => {
    const hero = { headline: 'B Hard', subheadline: 'Five tablets.', cta_text: 'Get notified', cta_link: '#contact', image_url: 'https://x.test/tin.webp' };
    const { container } = render(<RenderVideoShowcase content={{ ...two, hero } as any} />);
    expect(container.querySelector('section')?.getAttribute('data-video-showcase-hero')).toBe('1');
    expect(container.querySelector('h1')?.textContent).toBe('B Hard');
    expect(container.querySelector('h2')?.textContent).toBe('Ok, now that’s new!');
    expect(container.querySelector('img')?.className).toMatch(/max-w-\[260px\]/);
    const cta = container.querySelector('a[href="#contact"]');
    expect(cta?.textContent).toBe('Get notified');
    expect(cta?.className).toMatch(/min-h-\[44px\]/);
    expect(container.querySelectorAll('video')).toHaveLength(2);
    expect(container.querySelector('section')?.className).not.toMatch(/-mt-/);
  });

  it('the default content validates and the schema caps at three videos', () => {
    const schema = (blockContentSchemaMap as any).video_showcase.schema;
    expect(schema.safeParse((DEFAULT_BLOCK_CONTENT as any).video_showcase).success).toBe(true);
    expect(schema.safeParse({ videos: Array(4).fill({ url: 'https://x.test/v.mp4' }) }).success).toBe(false);
  });
});
