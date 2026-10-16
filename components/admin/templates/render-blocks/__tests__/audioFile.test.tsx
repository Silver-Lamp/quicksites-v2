// audio block, `file` provider (the B Hard ad jingles, 2026-10-16): a native player with visible
// controls, never autoplay, metadata only until pressed. Embeds are unchanged.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AudioBlock, { isAudioFileUrl } from '@/components/admin/templates/render-blocks/audio';

const MP3 = 'https://kcwruliugwidsdgsrthy.supabase.co/storage/v1/object/public/videos/bhard/jingle-bhard.mp3';

describe('audio block — direct file', () => {
  it('renders a native <audio controls> with the title and caption, no autoplay, metadata preload', () => {
    const html = renderToStaticMarkup(<AudioBlock content={{ provider: 'file', url: MP3, title: 'B Hard jingle', caption: 'Ad jingle · 32 s' } as any} />);
    expect(html).toMatch(/<audio[^>]*controls/);
    expect(html).toMatch(/preload="metadata"/);
    expect(html).not.toMatch(/autoplay/i);
    expect(html).toContain('B Hard jingle');
    expect(html).toContain('Ad jingle · 32 s');
    expect(html).not.toContain('<iframe');
  });
  it('a plainly-audio URL under an embed provider still gets the native player (the iframe would 404 the page into a box)', () => {
    const html = renderToStaticMarkup(<AudioBlock content={{ provider: 'suno', url: MP3 } as any} />);
    expect(html).toMatch(/<audio[^>]*controls/);
  });
  it('an embed URL keeps the iframe', () => {
    const html = renderToStaticMarkup(<AudioBlock content={{ provider: 'spotify', url: 'https://open.spotify.com/embed/track/abc' } as any} />);
    expect(html).toContain('<iframe');
    expect(html).not.toContain('<audio');
  });
  it('the palette default renders NOTHING in public (no dead player, no iframe to example.com)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_BLOCK_CONTENT: defaultBlockContent } = require('@/lib/blocks/defaultBlockContent');
    const html = renderToStaticMarkup(<AudioBlock content={defaultBlockContent.audio} />);
    expect(html).toBe('');
    expect(defaultBlockContent.audio.url).toBe('');
  });
  it('isAudioFileUrl', () => {
    expect(isAudioFileUrl(MP3)).toBe(true);
    expect(isAudioFileUrl('https://x/y.wav?x=1')).toBe(true);
    expect(isAudioFileUrl('https://open.spotify.com/embed/track/abc')).toBe(false);
  });
});
