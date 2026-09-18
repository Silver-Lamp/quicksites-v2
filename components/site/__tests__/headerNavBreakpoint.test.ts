/**
 * @jest-environment node
 */
// components/site/__tests__/headerNavBreakpoint.test.ts
//
// The desktop nav and the burger menu must be exact complements, and the nav must only appear at a
// width that actually fits it.
//
// Found 2026-09-18 while checking the templates against foldable viewport widths (HiveJournal's
// iPhone Duo note): the nav measured 805px on production but was shown from `md:` (768px), so every
// page overflowed horizontally by ~139px between 768 and ~805px — a real horizontal scrollbar on
// exactly the width an unfolded foldable reports. The nav grows every time a marketing page is
// added, which is why this is a guard and not a one-time fix.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'components/site/site-header.tsx'), 'utf8');
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n');

describe('site header nav breakpoint', () => {
  it('shows the desktop nav no earlier than lg (the md nav overflowed at 768px)', () => {
    expect(code).toContain('hidden lg:flex');
    expect(code).not.toContain('hidden md:flex');
  });

  it('hides the burger at exactly the same breakpoint — they must be complements', () => {
    expect(code).toContain('lg:hidden');
    expect(code).not.toMatch(/className="md:hidden"/);
  });
});
