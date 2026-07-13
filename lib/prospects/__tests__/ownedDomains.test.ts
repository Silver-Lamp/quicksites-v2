/**
 * @jest-environment node
 */
// lib/prospects/__tests__/ownedDomains.test.ts

import {
  normalizeDomain,
  domainLabelKey,
  parseOwnedDomains,
  buildOwnedIndex,
  matchOwned,
} from '@/lib/prospects/ownedDomains';

describe('normalizeDomain', () => {
  it('strips protocol, www, path, and lowercases', () => {
    expect(normalizeDomain('HTTPS://WWW.Gallatin-Towing.com/tow?x=1')).toBe('gallatin-towing.com');
  });
  it('drops trailing dots and blanks', () => {
    expect(normalizeDomain('foo.com.')).toBe('foo.com');
    expect(normalizeDomain('   ')).toBe('');
    expect(normalizeDomain('12345')).toBe(''); // no letters → not domain-ish
  });
});

describe('domainLabelKey — hyphen/TLD-insensitive', () => {
  it('reduces to the alnum label of the SLD', () => {
    expect(domainLabelKey('gallatin-towing.com')).toBe('gallatintowing');
    expect(domainLabelKey('gallatintowing.net')).toBe('gallatintowing');
    expect(domainLabelKey('gallatintowing')).toBe('gallatintowing');
    expect(domainLabelKey('www.gallatin-towing.com')).toBe('gallatintowing');
  });
});

describe('parseOwnedDomains', () => {
  it('splits on newlines/commas/whitespace and dedupes', () => {
    const out = parseOwnedDomains('gallatin-towing.com, arab-towing.com\n arabtowing.com\ngallatin-towing.com');
    expect(out).toEqual(['gallatin-towing.com', 'arab-towing.com', 'arabtowing.com']);
  });
});

describe('matchOwned', () => {
  const idx = buildOwnedIndex(['gallatin-towing.com', 'arabtowing.com', 'cullman-towing.net']);

  it('exact match on the same normalized domain', () => {
    expect(matchOwned('gallatin-towing.com', idx)).toBe('exact');
    expect(matchOwned('https://www.gallatin-towing.com', idx)).toBe('exact');
  });

  it('similar match when the dash-stripped label is owned (different dash or TLD)', () => {
    // owned "arabtowing.com" → candidate "arab-towing.com" is the same asset
    expect(matchOwned('arab-towing.com', idx)).toBe('similar');
    // owned "cullman-towing.net" → candidate ".com" is similar, not exact
    expect(matchOwned('cullman-towing.com', idx)).toBe('similar');
  });

  it('returns null for an unowned domain', () => {
    expect(matchOwned('florence-towing.com', idx)).toBeNull();
  });

  it('empty index matches nothing', () => {
    const empty = buildOwnedIndex('');
    expect(empty.count).toBe(0);
    expect(matchOwned('gallatin-towing.com', empty)).toBeNull();
  });
});
