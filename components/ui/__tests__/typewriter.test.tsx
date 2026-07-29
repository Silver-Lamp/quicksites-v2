/** @jest-environment jsdom */
//
// The rule this guards: ANIMATE PRESENTATION, NEVER CONTENT.
//
// Typewriter renders load-bearing sentences — the guest banner's "your work is saved" among
// them. While it typed, the DOM held a TRUNCATED version of that promise for ~2s, so anything
// reading rendered text early (an automated browser, a screenshot-and-extract agent, a scraper)
// could read a half-sentence and conclude the opposite of what we say. The full text must be
// present at every instant; only its visibility animates.
import * as React from 'react';
import { render, act } from '@testing-library/react';
import Typewriter from '../typewriter';

const TEXT = 'You’re building as a guest. Sign up to publish your site — your work is saved.';

describe('Typewriter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds the complete sentence in the DOM from the very first frame', () => {
    const { container } = render(<Typewriter text={TEXT} />);
    // Before the start delay has even elapsed — zero characters "typed".
    expect(container.textContent).toContain(TEXT);
  });

  it('still holds it mid-type, when only part is visible', () => {
    const { container } = render(<Typewriter text={TEXT} />);
    act(() => {
      jest.advanceTimersByTime(300 + 26 * 10); // past the delay, ~10 chars in
    });
    expect(container.textContent).toContain(TEXT);
  });

  it('exposes the full text to assistive tech immediately', () => {
    const { container } = render(<Typewriter text={TEXT} />);
    expect(container.querySelector(`[aria-label="${TEXT}"]`)).not.toBeNull();
  });

  it('renders instantly and calls onDone under prefers-reduced-motion', () => {
    const mm = window.matchMedia;
    // @ts-expect-error test stub
    window.matchMedia = () => ({ matches: true });
    const onDone = jest.fn();
    const { container } = render(<Typewriter text={TEXT} onDone={onDone} />);
    expect(container.textContent).toContain(TEXT);
    expect(onDone).toHaveBeenCalled();
    window.matchMedia = mm;
  });

  it('does not split surrogate pairs while typing', () => {
    const { container } = render(<Typewriter text="ok 👍 done" />);
    act(() => {
      jest.advanceTimersByTime(300 + 26 * 4); // lands on the emoji
    });
    // A naive slice(0, n) on the string would emit a lone surrogate here.
    expect(container.textContent).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
