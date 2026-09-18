/**
 * @jest-environment node
 */
// app/pricing/__tests__/doneForYou.test.ts
//
// The pricing page and a sent proposal must agree. The proposal (Tampa law firm, 2026-09-17) said
// $1,995 build, $49/mo self-service, $149/mo managed — and the page said "free hosting, no monthly
// fee" everywhere. Both are true only if the page (a) carries the same figures from ONE constant
// and (b) says what the monthly buys, which is not hosting. This pins both.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8');
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n');

describe('/pricing — done-for-you figures', () => {
  it('declares the three figures in one constant', () => {
    expect(code).toMatch(/const DONE_FOR_YOU = \{ buildFrom: 1995, careSelfService: 49, careManaged: 149 \}/);
  });

  it('never types the figures into JSX or FAQ prose (they must come from the constant)', () => {
    // Allowed: the constant declaration line. Disallowed: a literal "$1,995", "$49/mo", "$149/mo".
    expect(code).not.toMatch(/\$1,995/);
    expect(code).not.toMatch(/\$49\s*\/\s*mo/);
    expect(code).not.toMatch(/\$149\s*\/\s*mo/);
    expect(code).toMatch(/usd0\.format\(DONE_FOR_YOU\.buildFrom\)/);
    expect(code).toMatch(/usd0\.format\(DONE_FOR_YOU\.careSelfService\)/);
    expect(code).toMatch(/usd0\.format\(DONE_FOR_YOU\.careManaged\)/);
  });

  it('says hosting is free on every plan right where the monthly figures appear', () => {
    const at = code.indexOf('function DoneForYouSection');
    expect(at).toBeGreaterThan(-1);
    const section = code.slice(at, code.indexOf('const FAQS'));
    expect(section).toMatch(/Hosting is free on every QuickSites plan/);
    expect(section).toMatch(/not servers/);
  });

  it('is reachable from the path chooser and has its own anchor', () => {
    expect(code).toContain("href: '#done-for-you'");
    expect(code).toContain('id="done-for-you"');
  });

  it('has an FAQ entry that answers "can you build it for me"', () => {
    expect(code).toMatch(/q: 'Can you just build it for me\?'/);
  });
});
