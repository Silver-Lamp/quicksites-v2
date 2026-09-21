// app/__tests__/serverPagesHaveNoHandlers.test.ts
//
// A server component with an inline event handler (onClick=, onChange=, …) is not a lint
// warning: it renders fine while the branch that holds it is empty and becomes
// "Application error: a server-side exception has occurred" the day it has data.
// /admin/referrals shipped that way for 13 months and died the week the first referral
// codes existed. React hooks in a server page 500 on every request (/search). Both are a
// property of the source, so this pins them repo-wide.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PAGES = execSync("git ls-files 'app/**/page.tsx' 'app/**/layout.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const HANDLER = /\son(Click|Change|Submit|Input|Blur|Focus|KeyDown|KeyUp|MouseEnter|MouseLeave)=\{/;
const HOOK = /\buse(State|Effect|Ref|Memo|Callback|Reducer|Context|SearchParams|Router|Pathname)\(/;

function isClient(src: string): boolean {
  return /^\s*['"]use client['"]/m.test(src.split('\n').slice(0, 5).join('\n'));
}

describe('server pages carry no client-only code', () => {
  it('scans a non-empty set', () => {
    expect(PAGES.length).toBeGreaterThan(50);
  });

  it('no inline event handler in a server page or layout', () => {
    const bad = PAGES.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return !isClient(src) && HANDLER.test(src);
    });
    expect(bad).toEqual([]);
  });

  it('no React hook call in a server page or layout', () => {
    const bad = PAGES.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return !isClient(src) && HOOK.test(src);
    });
    expect(bad).toEqual([]);
  });
});
