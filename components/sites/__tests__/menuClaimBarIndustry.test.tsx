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
