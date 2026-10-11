/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import MenuClaimBar from '@/components/sites/menu-claim-bar';
it('food keeps the restaurant wording', () => {
  render(<MenuClaimBar templateId="t" token="x" isFood />);
  expect(screen.getByText(/Is this your restaurant\?/)).toBeTruthy();
  expect(screen.getByText(/take online orders/)).toBeTruthy();
});
it('non-food says business and drops the ordering promise', () => {
  render(<MenuClaimBar templateId="t" token="x" isFood={false} />);
  expect(screen.getByText(/Is this your business\?/)).toBeTruthy();
  expect(screen.queryByText(/take online orders/)).toBeNull();
});
it('a page built from the owner\'s POST starts compact: a small claim pill, no sentence, no ✕ (11 of 72 salmon-page visitors dismissed the full bar, 2026-10-11)', () => {
  render(<MenuClaimBar templateId="t" token="x" isFood builtFrom="post" />);
  expect(screen.getByText(/Is this your page\? Claim it/)).toBeTruthy();
  expect(screen.queryByText(/We built it from/)).toBeNull();
  expect(screen.queryByRole('button', { name: /minimize/i })).toBeNull();
});
it('a listing-import page keeps the full bar by default', () => {
  render(<MenuClaimBar templateId="t" token="x" isFood builtFrom="listing" />);
  expect(screen.getByText(/We built it from your public listing/)).toBeTruthy();
});
