/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Agreement from '../agreement';

const block = (content: any): any => ({ _id: 'blk1', type: 'agreement', content });

const TERMS = {
  title: 'Kitchen Liability Waiver',
  body: 'Meals are prepared in a home kitchen.\n\nI accept that risk.',
  button_label: 'I accept',
  confirmation: 'Thank you — your acceptance has been recorded.',
};

describe('agreement block', () => {
  it('renders the terms as separate paragraphs, verbatim', () => {
    render(<Agreement block={block(TERMS)} template={{ id: 't1' }} />);
    expect(screen.getByText('Kitchen Liability Waiver')).toBeTruthy();
    expect(screen.getByText(/Meals are prepared in a home kitchen\./)).toBeTruthy();
    expect(screen.getByText(/I accept that risk\./)).toBeTruthy();
  });

  it('says ACCEPT, never SIGN — a public page cannot evidence who is at the keyboard', () => {
    // The whole distinction from the private signing link. If this ever fails because someone
    // "improved" the wording, the block is claiming an identity check it did not perform.
    const { container } = render(<Agreement block={block(TERMS)} template={{ id: 't1' }} />);
    expect(container.textContent).not.toMatch(/\bsign(ed|ature)?\b/i);
    expect(container.textContent).toMatch(/accept/i);
  });

  it('disables the button until BOTH a name and consent are given', () => {
    render(<Agreement block={block(TERMS)} template={{ id: 't1' }} />);
    const button = screen.getByRole('button', { name: /i accept/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/type your full name/i), {
      target: { value: 'A Visitor' },
    });
    expect(button.disabled).toBe(true); // name alone is not consent

    fireEvent.click(screen.getByRole('checkbox'));
    expect(button.disabled).toBe(false);
  });

  it('also requires an email when the block asks for one', () => {
    render(<Agreement block={block({ ...TERMS, require_email: true })} template={{ id: 't1' }} />);
    const button = screen.getByRole('button', { name: /i accept/i }) as HTMLButtonElement;
    fireEvent.change(screen.getByPlaceholderText(/type your full name/i), {
      target: { value: 'A Visitor' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/your email/i), {
      target: { value: 'v@example.com' },
    });
    expect(button.disabled).toBe(false);
  });

  it('renders NOTHING on a published page when unconfigured', () => {
    // Editor-speak never reaches a visitor (CUSTOM_SITES §4 rule 6).
    const { container } = render(<Agreement block={block({})} />);
    expect(container.textContent).toBe('');
  });

  it('shows a hint in the editor, where it can be fixed', () => {
    const { container } = render(<Agreement block={block({})} previewOnly />);
    expect(container.textContent).toMatch(/add a title and the terms/i);
  });

  it('does not offer a working control in editor preview', () => {
    render(<Agreement block={block(TERMS)} template={{ id: 't1' }} previewOnly />);
    const button = screen.getByRole('button', { name: /i accept/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
