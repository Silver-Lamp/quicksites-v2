/**
 * @jest-environment node
 */
// lib/gsc/__tests__/resolveProperty.test.ts

import { gscPropertyFor } from '@/lib/gsc/resolveProperty';

describe('gscPropertyFor', () => {
  const map = new Map<string, string>([
    ['boston-towing.com', 'sc-domain:boston-towing.com'],
    ['renton-plumbing.com', 'https://renton-plumbing.com/'],
  ]);

  it('resolves a bare campaign domain to its stored sc-domain property', () => {
    expect(gscPropertyFor(map, 'boston-towing.com')).toBe('sc-domain:boston-towing.com');
  });

  it('matches regardless of scheme/www on the query domain', () => {
    expect(gscPropertyFor(map, 'https://www.boston-towing.com/')).toBe('sc-domain:boston-towing.com');
  });

  it('resolves a URL-prefix property too', () => {
    expect(gscPropertyFor(map, 'renton-plumbing.com')).toBe('https://renton-plumbing.com/');
  });

  it('returns null for an unconnected domain', () => {
    expect(gscPropertyFor(map, 'quincy-hvac.com')).toBeNull();
    expect(gscPropertyFor(map, '')).toBeNull();
  });
});
