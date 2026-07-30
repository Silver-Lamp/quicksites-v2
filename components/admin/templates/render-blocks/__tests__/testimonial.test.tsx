/** @jest-environment jsdom */
//
// The gate that keeps invented reviewers off a published page.
//
// The editor can generate testimonials and marks each `ai_generated: true`, showing an
// "AI Sample" badge. That badge only ever existed in the editor — the renderer ignored the
// flag, so a generated "Jake M. ★★★★★" published identically to a real customer's review, and
// four live sites were serving exactly that. The honesty existed and did not survive
// publication.
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import TestimonialBlock from '../testimonial';

const block = (testimonials: any[]) =>
  ({ type: 'testimonial', content: { title: 'What customers say', testimonials } }) as any;

const REAL = { quote: 'They fixed my roof in a day.', attribution: 'Dana P.', rating: 5 };
const AI = { quote: 'Fast, courteous, and professional.', attribution: 'Jake M.', rating: 5, ai_generated: true };

describe('TestimonialBlock — AI samples never reach a visitor', () => {
  it('hides a generated testimonial on the published render', () => {
    render(<TestimonialBlock block={block([AI])} template={{} as any} />);
    expect(screen.queryByText(/Jake M\./)).toBeNull();
  });

  it('shows it in the editor, where the operator can act on it', () => {
    render(<TestimonialBlock block={block([AI])} template={{} as any} previewOnly />);
    expect(screen.getByText(/Jake M\./)).toBeTruthy();
  });

  it('publishes real ones normally, and drops only the generated from a mixed list', () => {
    render(<TestimonialBlock block={block([REAL, AI])} template={{} as any} />);
    expect(screen.getByText(/Dana P\./)).toBeTruthy();
    expect(screen.queryByText(/Jake M\./)).toBeNull();
  });

  // The editor sets ai_generated:false on every edit path, so "a human rewrote it" is already
  // recorded — an operator who puts a real customer's words in a sample publishes normally.
  it('publishes a sample once a human has edited it (flag cleared)', () => {
    render(<TestimonialBlock block={block([{ ...AI, ai_generated: false }])} template={{} as any} />);
    expect(screen.getByText(/Jake M\./)).toBeTruthy();
  });

  // If filtering empties the list, the section must vanish rather than announce its own
  // emptiness on a real business's page.
  it('renders nothing at all when every testimonial was generated', () => {
    const { container } = render(<TestimonialBlock block={block([AI])} template={{} as any} />);
    expect(container.querySelector('section')).toBeNull();
  });
});
