// A panel wired to a placeholder id answers a real question with a confident lie.
//
// `PaymentSettingsPanel` shipped with merchantId={'00001'} in the site-settings sidebar. It is
// not a uuid and not a merchant, so every site read "Not connected" with a 0.75% fee regardless
// of its actual Stripe account, and "Enable payouts" returned
// `invalid input syntax for type uuid: "00001"`. The status looked plausible, which is why it
// survived — "am I connected?" is exactly what an owner opens that panel to find out.
//
// Scoped to the id props that address a row in the database. A hard-coded one there is always
// a stub someone meant to replace.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, out);
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.DEAD.')) out.push(full);
  }
  return out;
}

// merchantId={'00001'} / merchantId="abc" / siteId={"123"} — a literal where a row id belongs.
const LITERAL_ID_PROP = /\b(merchantId|siteId|orgId|templateId|customerId)\s*=\s*[{]?\s*['"]([^'"]*)['"]\s*[}]?/g;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Strip comments before scanning. The first run of this test failed on the comment that
 * documents the bug it was written to catch — quoting bad code is how a fix explains itself,
 * and a checker that forbids naming the defect pushes the explanation out of the codebase.
 * `//` is only treated as a comment when not preceded by `:`, so URLs survive intact.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('admin panels are not wired to placeholder record ids', () => {
  const files = tsxFiles(ROOT);

  it('scans a non-empty set of admin components', () => {
    // A sweep that matches nothing reports success. Pin the corpus so a refactor that moves
    // these files turns this suite red instead of quietly passing over zero of them.
    expect(files.length).toBeGreaterThan(20);
  });

  it('passes no hard-coded id literal to a component prop', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      for (const m of src.matchAll(LITERAL_ID_PROP)) {
        const [, prop, value] = m;
        // A real uuid is a deliberate pin (a demo/fixture row), not a forgotten stub.
        if (isUuid(value)) continue;
        offenders.push(`${path.relative(ROOT, file)}: ${prop}="${value}"`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
