/**
 * @jest-environment node
 */
// The owner-facing export. Its whole job is to make "it's yours, take it anywhere" checkable
// rather than promised, so the properties that matter are about ownership and honesty, not output
// formatting.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'app/api/sites/[id]/export/route.ts'),
  'utf8',
);
const launcher = readFileSync(join(process.cwd(), 'components/hear-this-page.tsx'), 'utf8');

describe('the export is owner-only', () => {
  // ⚠️ It walks away with the whole rendered site. "It's yours" is exactly the sentence that makes
  // checking whose it is non-negotiable.
  it('requires a signed-in user and matches owner_id', () => {
    expect(route).toMatch(/requireUser\(\)/);
    expect(route).toMatch(/owner_id !== gate\.user\.id/);
    expect(route).toMatch(/403/);
  });
});

describe('the page removes our chrome, the exporter does not guess at it', () => {
  it('asks the page with ?qs_export=1 rather than parsing our controls out', () => {
    expect(route).toMatch(/\?qs_export=1/);
    expect(launcher).toMatch(/qs_export/);
  });
});

describe('failures are named, not swallowed', () => {
  // ⚠️ A hole in a file you were told is complete is worse than a hole you were told about — the
  // same rule as the Verbatim parser reporting what a résumé did not yield.
  it('lists assets it could not embed inside the exported file', () => {
    expect(route).toMatch(/could not be embedded/);
    expect(route).toMatch(/failed\.join/);
  });

  it('says which step failed when the site itself cannot be read', () => {
    expect(route).toMatch(/Could not read \$\{pageUrl\}/);
    // "Export failed" on the button whose job is to prove we are not holding their site hostage
    // would be the worst possible message.
    expect(route).not.toMatch(/'Export failed'/);
  });
});

describe('it cannot be used to pull an unbounded payload', () => {
  it('caps per-asset and total bytes', () => {
    expect(route).toMatch(/MAX_ASSET_BYTES/);
    expect(route).toMatch(/MAX_TOTAL_BYTES/);
  });
});

describe('what leaves is theirs, not ours', () => {
  it('drops our scripts and the stylesheet links it inlined', () => {
    expect(route).toMatch(/\$\('script'\)\.remove\(\)/);
    expect(route).toMatch(/\$\('link\[rel="stylesheet"\]'\)\.remove\(\)/);
  });
});
