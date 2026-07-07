import * as React from 'react';
import { render, screen } from '@testing-library/react';
import StoryBlock from '../story';

function block(sections: any[], title?: string) {
  return { id: 'b1', type: 'story', content: { title, sections } } as any;
}

describe('StoryBlock', () => {
  it('renders a heading + body per section, plus an optional title', () => {
    render(
      <StoryBlock
        block={block(
          [
            { heading: 'Created by 2 NPs', body: 'From Texas.', image_url: 'https://cdn/1.png' },
            { heading: 'Play your shift', body: 'Day, swing, night.', image_url: 'https://cdn/2.png' },
          ],
          'Why players love it',
        )}
      />,
    );
    expect(screen.getByText('Why players love it')).toBeTruthy();
    expect(screen.getByText('Created by 2 NPs')).toBeTruthy();
    expect(screen.getByText('Day, swing, night.')).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('alternates the image side (2nd section reversed)', () => {
    const { container } = render(
      <StoryBlock
        block={block([
          { heading: 'A', body: 'a', image_url: 'https://cdn/1.png' },
          { heading: 'B', body: 'b', image_url: 'https://cdn/2.png' },
        ])}
      />,
    );
    const imgWrappers = Array.from(container.querySelectorAll('div')).filter((d) =>
      d.className.includes('md:order-'),
    );
    // First image wrapper is order-1 (image left); second is order-2 (image right).
    expect(container.innerHTML).toContain('md:order-1');
    expect(container.innerHTML).toContain('md:order-2');
    expect(imgWrappers.length).toBeGreaterThan(0);
  });

  it('renders a text-only (full-width) section when it has no image', () => {
    render(<StoryBlock block={block([{ heading: 'No image', body: 'just text' }])} />);
    expect(screen.getByText('No image')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders a CTA link only when both text and link are present', () => {
    render(
      <StoryBlock
        block={block([
          { heading: 'A', body: 'a', cta_text: 'Buy Now', cta_link: '/shop' },
          { heading: 'B', body: 'b', cta_text: 'No link' }, // link missing → no CTA
        ])}
      />,
    );
    const cta = screen.getByText('Buy Now');
    expect(cta.closest('a')?.getAttribute('href')).toBe('/shop');
    expect(screen.queryByText('No link')).toBeNull();
  });

  it('renders nothing when there are no usable sections', () => {
    const { container } = render(<StoryBlock block={block([])} />);
    expect(container.firstChild).toBeNull();
  });
});
