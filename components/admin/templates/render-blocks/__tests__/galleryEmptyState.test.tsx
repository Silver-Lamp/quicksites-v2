// The gallery's empty state, both sides of it.
//
// ⚠️ THE BLOCK EXISTED AND NOBODY COULD REACH IT. Schema, renderer, editor and a scaffold line
// all shipped — and it appeared on ZERO of ~2,800 live templates, because the scaffold gated it
// on `industry === 'photography'` and we have no photography sites. Then, once seeded, an empty
// gallery returned null unconditionally: invisible in the builder too, so an owner would never
// learn it was there. Built, seeded, and still invisible is worse than absent.

import React from 'react';
import { render, screen } from '@testing-library/react';
import RenderGallery from '@/components/admin/templates/render-blocks/gallery';

const block = (images: Array<{ url: string }> = []) =>
  ({ _id: 'g1', type: 'gallery', content: { title: 'Our work', columns: 3, images } }) as any;

describe('empty gallery', () => {
  // ⚠️ The visitor-facing half. "Gallery" with no photos tells a prospect the business is
  // half-built — the footer-hints rule, the services rule, the products_grid rule.
  it('renders NOTHING in public', () => {
    const { container } = render(<RenderGallery block={block()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prompts the owner in the editor', () => {
    render(<RenderGallery block={block()} previewOnly />);
    expect(screen.getByText(/add images in this block/i)).toBeInTheDocument();
    // And it says the live site stays clean, so the prompt is not mistaken for a broken block.
    expect(screen.getByText(/nothing shows on your live site/i)).toBeInTheDocument();
  });
});

describe('populated gallery', () => {
  it('renders the images in public', () => {
    const { container } = render(<RenderGallery block={block([{ url: 'https://x/a.jpg' }])} />);
    expect(container.querySelectorAll('img').length).toBeGreaterThan(0);
    expect(screen.queryByText(/add images in this block/i)).toBeNull();
  });
});
