// The named work index — the block a photographer, designer or author sells on.

import React from 'react';
import { render, screen } from '@testing-library/react';
import RenderSelectedWork from '@/components/admin/templates/render-blocks/selected-work';

const c = (items: any[], extra: Record<string, unknown> = {}) =>
  ({ title: 'Selected work', layout: 'list', items, ...extra });

describe('empty', () => {
  it('renders nothing in public', () => {
    const { container } = render(<RenderSelectedWork content={c([])} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('prompts in the editor', () => {
    render(<RenderSelectedWork content={c([])} previewOnly />);
    expect(screen.getByText(/nothing shows on your live site/i)).toBeInTheDocument();
  });
});

describe('entries', () => {
  // ⚠️ A row without a title is not a credit. An image-only entry belongs in the gallery; here
  // it would render as an untitled credit, which is the thing this block exists to avoid.
  it('ignores rows with no title, even if they have an image', () => {
    const { container } = render(
      <RenderSelectedWork content={c([{ image: 'https://x/a.jpg' }, { title: 'Solstice' }])} />,
    );
    expect(screen.getByText('Solstice')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(1);
  });

  it('renders title, meta and blurb', () => {
    render(<RenderSelectedWork content={c([
      { title: 'Terracotta Hour', meta: '2025 · Kinfolk', blurb: 'A series on light.' },
    ])} />);
    expect(screen.getByText('Terracotta Hour')).toBeInTheDocument();
    expect(screen.getByText('2025 · Kinfolk')).toBeInTheDocument();
    expect(screen.getByText('A series on light.')).toBeInTheDocument();
  });

  // ⚠️ The alt is the CREDIT, not a filename — a screen reader should hear what the work is.
  it('uses the title as the image alt', () => {
    const { container } = render(
      <RenderSelectedWork content={c([{ title: 'Drift', image: 'https://x/d.jpg' }])} />,
    );
    expect(container.querySelector('img')).toHaveAttribute('alt', 'Drift');
  });

  it('renders without an image at all', () => {
    const { container } = render(<RenderSelectedWork content={c([{ title: 'Gel' }])} />);
    expect(screen.getByText('Gel')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('links', () => {
  // ⚠️ Without noopener the opened page can reach back via window.opener and navigate this one.
  it('opens an external link safely', () => {
    const { container } = render(
      <RenderSelectedWork content={c([{ title: 'Reel', href: 'https://vimeo.com/x' }])} />,
    );
    const a = container.querySelector('a')!;
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('keeps an internal link in the same tab', () => {
    const { container } = render(
      <RenderSelectedWork content={c([{ title: 'About', href: '/about' }])} />,
    );
    const a = container.querySelector('a')!;
    expect(a).not.toHaveAttribute('target');
  });

  it('renders no anchor when there is no href', () => {
    const { container } = render(<RenderSelectedWork content={c([{ title: 'Lane Seven' }])} />);
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('layout', () => {
  it('grid renders a grid list', () => {
    const { container } = render(
      <RenderSelectedWork content={c([{ title: 'A' }, { title: 'B' }], { layout: 'grid' })} />,
    );
    expect(container.querySelector('ul')?.className).toContain('grid');
  });
});
