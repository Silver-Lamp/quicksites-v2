/**
 * @jest-environment node
 */
// lib/domains/__tests__/registrar.test.ts

import { toE164 } from '@/lib/domains/registrar';

// Vercel's registrar requires E.164: /^(?=(?:\D*\d){8,15}$)\+[1-9]\d{0,2}\.?\d+$/
const E164 = /^(?=(?:\D*\d){8,15}$)\+[1-9]\d{0,2}\.?\d+$/;

describe('toE164', () => {
  it('adds +1 to a bare US 10-digit number', () => {
    expect(toE164('2623028118')).toBe('+12623028118');
    expect(E164.test(toE164('2623028118'))).toBe(true);
  });

  it('handles a US 11-digit number starting with 1', () => {
    expect(toE164('12623028118')).toBe('+12623028118');
  });

  it('strips formatting from a national number', () => {
    expect(toE164('(262) 302-8118')).toBe('+12623028118');
    expect(toE164('262.302.8118')).toBe('+12623028118');
  });

  it('preserves an already-E.164 number (stripping separators)', () => {
    expect(toE164('+12623028118')).toBe('+12623028118');
    expect(toE164('+1 262-302-8118')).toBe('+12623028118');
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('returns empty for blank input', () => {
    expect(toE164('')).toBe('');
    expect(toE164('   ')).toBe('');
  });
});
