/**
 * @jest-environment node
 */
// A @font-face must point at a file that exists.
//
// ⚠️ THIS ONE COST TWO FALSE BUG REPORTS. `globals.css` declared 'Roboto Slab' against
// /fonts/RobotoSlab-{Regular,Bold}.woff2, which have never existed — public/fonts holds only Arial
// and Inter. I fetched those URLs, saw 404, and twice described it as "a real bug on published
// sites". But a missing file is only a bug if something asks for it, and nothing did: no rendered
// rule uses the family, so no browser ever requested them.
//
// Measured on a live serif site (starter-turf) rather than inferred:
//     computed h1 font                     → "Fraunces, Georgia, …"
//     document.fonts.check('12px "Roboto Slab"') → false
//     font request failures                → none
//
// A 404 on a direct fetch proves the file is absent. It does not prove anything wants it. I
// reported those two as one thing. The only consumer was the site exporter, which fetches every
// url() in the CSS whether or not it is used — so dead CSS surfaced as a live defect.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'styles/globals.css'), 'utf8');
const refs = [...css.matchAll(/url\((["']?)(\/fonts\/[^"')]+)\1\)/g)].map((m) => m[2]);

describe('every local font referenced by globals.css exists', () => {
  it('finds the font references it is meant to check', () => {
    // ⚠️ A scan matching nothing reports success. If the last @font-face is ever removed this
    // fails loudly rather than passing vacuously.
    expect(refs.length).toBeGreaterThan(0);
  });

  it.each(refs)('%s is present in public/', (ref) => {
    expect(existsSync(join(process.cwd(), 'public', ref))).toBe(true);
  });

  it('no longer declares the family whose files were never shipped', () => {
    expect(css).not.toMatch(/url\(['"]?\/fonts\/RobotoSlab/);
  });
});
