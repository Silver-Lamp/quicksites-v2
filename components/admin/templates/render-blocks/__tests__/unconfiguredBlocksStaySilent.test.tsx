// ⚠️ A BLOCK NOBODY FILLED IN MUST RENDER NOTHING TO A VISITOR — AND SOMETHING TO ITS OWNER.
//
// Measured before the fix, on a live-site render path:
//   video → <video controls><source></video>   a player with nothing to play
//   image → <img>                              no src
//   audio → <iframe style="height:80px">       an empty box
//   gallery, reviews → null everywhere         invisible to the owner too, so never filled
//
// Both halves are bugs. The first ships broken furniture to a customer; the second is why
// `gallery` and `reviews` sat on ZERO of ~2,800 templates while having schemas, renderers and
// editors. Same rule as products_grid and the footer hints.

import React from 'react';
import { render, screen } from '@testing-library/react';
import VideoBlock from '@/components/admin/templates/render-blocks/video';
import ImageBlock from '@/components/admin/templates/render-blocks/image';
import AudioBlock from '@/components/admin/templates/render-blocks/audio';
import RenderGallery from '@/components/admin/templates/render-blocks/gallery';
import RenderReviews from '@/components/admin/templates/render-blocks/reviews';

const CASES: Array<[string, React.ComponentType<any>, Record<string, unknown>]> = [
  ['video', VideoBlock, {}],
  ['image', ImageBlock, {}],
  ['audio', AudioBlock, {}],
  ['gallery', RenderGallery, { images: [] }],
  ['reviews', RenderReviews, { reviews: [] }],
];

describe('public: silence', () => {
  it.each(CASES)('%s renders nothing', (_n, C, content) => {
    const { container } = render(<C content={content} />);
    expect(container).toBeEmptyDOMElement();
  });

  // The specific regressions: an element with no source is not "nothing".
  it.each(CASES)('%s emits no empty media element', (_n, C, content) => {
    const { container } = render(<C content={content} />);
    expect(container.querySelector('video,img,iframe,source')).toBeNull();
  });
});

describe('editor: a prompt', () => {
  it.each(CASES)('%s tells the owner it is there', (_n, C, content) => {
    render(<C content={content} previewOnly />);
    expect(screen.getByText(/nothing shows on your live site/i)).toBeInTheDocument();
  });
});

describe('configured blocks still render', () => {
  it('video with a url', () => {
    const { container } = render(<VideoBlock content={{ url: 'https://x/a.mp4' }} />);
    expect(container.querySelector('source')).toHaveAttribute('src', 'https://x/a.mp4');
  });
  it('image with a url, and a decorative alt rather than a placeholder', () => {
    const { container } = render(<ImageBlock content={{ url: 'https://x/a.jpg' }} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://x/a.jpg');
    // ⚠️ '' (decorative) — a screen reader announcing a filename is worse than silence.
    expect(img.getAttribute('alt')).toBe('');
  });
  it('reviews with a real one', () => {
    render(<RenderReviews content={{ reviews: [{ author: 'A Reader', rating: 5, text: 'Loved it.' }] }} />);
    expect(screen.getByText(/Loved it\./)).toBeInTheDocument();
  });
});
