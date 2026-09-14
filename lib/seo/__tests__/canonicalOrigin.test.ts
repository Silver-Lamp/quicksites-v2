/**
 * @jest-environment node
 */
// lib/seo/__tests__/canonicalOrigin.test.ts
//
// `meta.canonical_origin` lets a site reachable on several hosts nominate ONE. The helper must
// accept only an https origin: anything else either canonicalises every page to one URL (a stored
// path) or points search engines at a host that may not serve (http, credentials, junk).

import fs from 'node:fs';
import path from 'node:path';
import { canonicalOriginFromMeta } from '@/lib/seo/canonicalUrl';

describe('canonicalOriginFromMeta', () => {
  it('returns a normalised https origin', () => {
    expect(canonicalOriginFromMeta({ canonical_origin: 'https://www.renton-restaurant.com' })).toBe(
      'https://www.renton-restaurant.com',
    );
    expect(canonicalOriginFromMeta({ canonical_origin: ' https://WWW.Kent-Restaurant.com/ ' })).toBe(
      'https://www.kent-restaurant.com',
    );
  });

  it('refuses anything that is not a bare https origin', () => {
    for (const bad of [
      'http://www.renton-restaurant.com',
      'https://www.renton-restaurant.com/menu',
      'https://www.renton-restaurant.com/?x=1',
      'https://www.renton-restaurant.com/#top',
      'https://user:pw@www.renton-restaurant.com',
      'www.renton-restaurant.com',
      '',
      '   ',
    ]) {
      expect(canonicalOriginFromMeta({ canonical_origin: bad })).toBeNull();
    }
    expect(canonicalOriginFromMeta({ canonical_origin: 42 })).toBeNull();
    expect(canonicalOriginFromMeta({})).toBeNull();
    expect(canonicalOriginFromMeta(null)).toBeNull();
    expect(canonicalOriginFromMeta(undefined)).toBeNull();
  });
});

describe('the public site render honours it', () => {
  // A unit test cannot see a deleted call site; reading the file can. The menu-host route is the
  // one that serves the duplicate (`<apex>.delivered.menu`), so it is the one that must consult it.
  it('generateMetadata in app/sites consults canonicalOriginFromMeta', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/sites/[slug]/[[...rest]]/page.tsx'),
      'utf8',
    );
    expect(src).toMatch(/canonicalOriginFromMeta\(/);
  });
});
