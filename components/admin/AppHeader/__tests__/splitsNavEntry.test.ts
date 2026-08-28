/**
 * The rental-splits page must stay reachable from the sidebar.
 *
 * A page nobody can find is a page nobody uses, and this one is the only surface that
 * answers "who is owed what" — the answer lives nowhere else, so losing the link loses
 * the feature silently. Source-level assertions rather than a render test: the nav is a
 * static declaration, and what breaks is someone editing that declaration.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const NAV = join(process.cwd(), 'components/admin/AppHeader/AdminNavSections.tsx');
const src = readFileSync(NAV, 'utf8');

/** The declaration block for the splits entry, so assertions can't match another item. */
function splitsEntry(): string {
  const at = src.indexOf("href: '/admin/splits'");
  expect(at).toBeGreaterThan(-1);
  const start = src.lastIndexOf('{', at);
  const end = src.indexOf('},', at);
  return src.slice(start, end);
}

describe('sidebar entry for /admin/splits', () => {
  it('exists at all', () => {
    // The guard is worth having precisely because it is a one-line deletion away.
    expect(src).toContain("href: '/admin/splits'");
  });

  it('is admin-only — it shows what real people are paid', () => {
    expect(splitsEntry()).toContain('adminOnly: true');
  });

  it('carries search keywords beyond its own label', () => {
    // The sidebar search matches label + group + keywords. Without keywords the page is
    // findable only by someone who already knows it is called "Rental Splits", which is
    // exactly the person who does not need to search for it.
    const entry = splitsEntry();
    for (const term of ['commission', 'override', 'closer']) {
      expect(entry).toContain(`'${term}'`);
    }
  });

  it('search actually consults keywords, not just label and group', () => {
    // A keywords array nothing reads is decoration. Pin the filter itself.
    expect(src).toMatch(/keywords\s*\?\?\s*\[\]\)\.some\(/);
  });

  it('keywords survive flattening into search leaves', () => {
    // flattenNavLeaves builds what the search filters over; dropping keywords there would
    // leave the declaration correct and the search silently unchanged.
    const flat = src.slice(
      src.indexOf('function flattenNavLeaves'),
      src.indexOf('/* ---------------- Custom')
    );
    expect(flat).toContain('keywords');
  });
});
