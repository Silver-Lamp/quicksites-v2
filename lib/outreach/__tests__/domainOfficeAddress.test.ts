/**
 * @jest-environment node
 */
// lib/outreach/__tests__/domainOfficeAddress.test.ts

import { parseOfficeAddress, formatAddressLabel, suiteFromDomain } from '@/lib/outreach/domainOfficeAddress';

describe('suiteFromDomain', () => {
  it('is deterministic and looks like "2C"', () => {
    const a = suiteFromDomain('renton-plumbing.com');
    expect(a).toMatch(/^\d{1,2}[ABCD]$/);
    expect(suiteFromDomain('renton-plumbing.com')).toBe(a); // stable
  });
  it('differs across domains (usually)', () => {
    expect(suiteFromDomain('grafton-towing.com')).not.toBe(suiteFromDomain('boston-hvac.com'));
  });
});

describe('formatAddressLabel', () => {
  it('inserts a suite when line1 has none', () => {
    expect(formatAddressLabel({ line1: '1420 Commerce Way', suite: '2C', city: 'Renton', region: 'WA', postalCode: '98057' })).toBe(
      '1420 Commerce Way, Suite 2C, Renton, WA 98057',
    );
  });
  it("doesn't double a suite already in line1", () => {
    expect(formatAddressLabel({ line1: '1420 Commerce Way Suite 2C', suite: '2C', city: 'Renton', region: 'WA', postalCode: '98057' })).toBe(
      '1420 Commerce Way Suite 2C, Renton, WA 98057',
    );
  });
  it('handles a missing postal code', () => {
    expect(formatAddressLabel({ line1: '5 Industrial Park Dr', suite: '3B', city: 'Grafton', region: 'MA' })).toBe(
      '5 Industrial Park Dr, Suite 3B, Grafton, MA',
    );
  });
});

describe('parseOfficeAddress', () => {
  const fb = { city: 'Renton', region: 'WA', domain: 'renton-plumbing.com' };

  it('parses a well-formed JSON payload', () => {
    const raw = JSON.stringify({ line1: '1420 Commerce Way', suite: '2C', city: 'Renton', region: 'WA', postal_code: '98057' });
    const a = parseOfficeAddress(raw, fb)!;
    expect(a.source).toBe('ai_suggested');
    expect(a.suite).toBe('2C');
    expect(a.label).toBe('1420 Commerce Way, Suite 2C, Renton, WA 98057');
  });

  it('fills a suite from the domain when the model omits one', () => {
    const raw = JSON.stringify({ line1: '77 Flex Office Blvd', city: 'Renton', region: 'WA', zip: '98057' });
    const a = parseOfficeAddress(raw, fb)!;
    expect(a.suite).toBe(suiteFromDomain(fb.domain));
    expect(a.label).toContain('Renton, WA 98057');
  });

  it('falls back to the campaign city/region when the model omits them', () => {
    const a = parseOfficeAddress(JSON.stringify({ line1: '9 Depot St' }), fb)!;
    expect(a.city).toBe('Renton');
    expect(a.region).toBe('WA');
  });

  it('strips a "Suite " prefix the model may include in the suite field', () => {
    const a = parseOfficeAddress(JSON.stringify({ line1: '9 Depot St', suite: 'Suite 4D' }), fb)!;
    expect(a.suite).toBe('4D');
  });

  it('returns null on no line1 or bad JSON', () => {
    expect(parseOfficeAddress(JSON.stringify({ city: 'Renton' }), fb)).toBeNull();
    expect(parseOfficeAddress('not json', fb)).toBeNull();
    expect(parseOfficeAddress(null, fb)).toBeNull();
  });
});
