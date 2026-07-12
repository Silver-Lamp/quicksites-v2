/**
 * @jest-environment node
 */
// lib/outreach/mail/__tests__/postcardCost.test.ts

import { postcardUnitCents, estimatePostcardCents } from '@/lib/outreach/mail/postcardCost';

describe('postcard cost estimate', () => {
  const saved = process.env.LOB_POSTCARD_UNIT_CENTS;
  afterEach(() => {
    if (saved === undefined) delete process.env.LOB_POSTCARD_UNIT_CENTS;
    else process.env.LOB_POSTCARD_UNIT_CENTS = saved;
  });

  it('uses per-size defaults', () => {
    delete process.env.LOB_POSTCARD_UNIT_CENTS;
    expect(postcardUnitCents('4x6')).toBe(77);
    expect(postcardUnitCents('6x9')).toBe(116);
    expect(postcardUnitCents('6x11')).toBe(155);
  });

  it('honours the LOB_POSTCARD_UNIT_CENTS override across all sizes', () => {
    process.env.LOB_POSTCARD_UNIT_CENTS = '90';
    expect(postcardUnitCents('6x9')).toBe(90);
    expect(postcardUnitCents('4x6')).toBe(90);
  });

  it('ignores a non-positive / non-numeric override', () => {
    process.env.LOB_POSTCARD_UNIT_CENTS = 'nope';
    expect(postcardUnitCents('6x9')).toBe(116);
    process.env.LOB_POSTCARD_UNIT_CENTS = '0';
    expect(postcardUnitCents('6x9')).toBe(116);
  });

  it('multiplies unit by count', () => {
    delete process.env.LOB_POSTCARD_UNIT_CENTS;
    expect(estimatePostcardCents(10, '6x9')).toBe(1160);
    expect(estimatePostcardCents(0, '6x9')).toBe(0);
  });
});
