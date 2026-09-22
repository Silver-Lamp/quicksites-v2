/**
 * @jest-environment node
 *
 * The personal page is consolidated onto its exact-match domain by a platform-level 301
 * (next.config.mjs). It is a few lines of config with no UI and no test surface of its own, which
 * makes it exactly the kind of rule a later refactor drops without anyone noticing — and the
 * failure is silent: the page simply starts serving on the business property again, re-splitting
 * the ranking signal and re-polluting every fleet aggregate.
 *
 * Read as SOURCE rather than imported: next.config.mjs is ESM with a webpack import that Jest's
 * CJS transform will not load. A source guard is also the stronger check here — a unit test
 * cannot notice a deleted config block, reading the file can (same reasoning as the source guards
 * in lib/resumes/__tests__/versions.test.ts).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8');
const TARGET = 'https://sandonjurowski.com';

describe('personal page consolidation', () => {
  it('scans a non-empty config (a guard that reads nothing reports success)', () => {
    expect(SRC.length).toBeGreaterThan(500);
    expect(SRC).toContain('async redirects()');
  });

  it('301s the page and everything under it to the exact-match domain', () => {
    for (const source of ["source: '/sites/sandon'", "source: '/sites/sandon/:path*'"]) {
      expect(SRC).toContain(source);
    }
    // Permanent, so the ranking the page earned transfers instead of being discarded.
    const block = SRC.slice(SRC.indexOf('personalPageConsolidation'), SRC.indexOf('const authAliases'));
    expect(block).toContain(TARGET);
    expect(block.match(/permanent: true/g)?.length).toBeGreaterThanOrEqual(3);
    expect(block).not.toContain('permanent: false');
  });

  it('the subdomain rule is SCOPED — unscoped it would redirect the entire platform', () => {
    const m = SRC.match(/value:\s*'(\^sandon[^']+)'/);
    expect(m).toBeTruthy();
    // The pattern is a JS string literal, so its backslashes are escaped in source.
    const host = new RegExp(m![1].replace(/\\\\/g, '\\'));
    expect(host.test('sandon.quicksites.ai')).toBe(true);
    expect(host.test('www.quicksites.ai')).toBe(false);
    expect(host.test('quicksites.ai')).toBe(false);
    expect(host.test('notsandon.quicksites.ai')).toBe(false);
  });

  it('is wired into BOTH the local and deployed redirect lists', () => {
    // It shipped once returning only authAliases in dev, which made the rule untestable locally.
    const ret = SRC.slice(SRC.indexOf('return isLocal'));
    expect(ret.match(/personalPageConsolidation/g)?.length).toBe(2);
  });

  it('leaves the apex canonicalisation rule intact', () => {
    expect(SRC).toContain('https://www.quicksites.ai/:path*');
  });
});
