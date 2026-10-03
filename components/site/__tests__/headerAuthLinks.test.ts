/**
 * @jest-environment node
 */
// components/site/__tests__/headerAuthLinks.test.ts
//
// The public header carries Sign in / Sign up (owner, 2026-10-03). Before this the only way into
// an account from a marketing page was to know the URL. Guards:
//   • both links come from lib/auth/authLinks — four spellings of the auth route were once in use
//     and one existed; the helper is the only thing that knows the URL
//   • both the desktop nav and the mobile sheet render them — the sheet REPLACES the nav on a
//     phone, so a pair present only on desktop is absent for most visitors
//   • a signed-in member sees Dashboard + Sign out; an anonymous guest is a visitor
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LABEL_SIGN_IN, LABEL_SIGN_UP } from '@/lib/auth/authLinks';

const src = readFileSync(join(process.cwd(), 'components/site/site-header.tsx'), 'utf8');
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

describe('site header account links', () => {
  it('builds both hrefs with the shared helpers, never a literal /login', () => {
    expect(code).toMatch(/signInHref\(\)/);
    expect(code).toMatch(/signUpHref\(\)/);
    expect(code).not.toMatch(/['"`]\/login['"`?]/);
  });

  it('uses the canonical labels', () => {
    expect(code).toContain('LABEL_SIGN_IN');
    expect(code).toContain('LABEL_SIGN_UP');
    expect(LABEL_SIGN_IN).toBe('Sign in');
    expect(LABEL_SIGN_UP).toBe('Sign up');
  });

  it('renders the pair in BOTH the desktop nav and the mobile sheet', () => {
    expect(code).toMatch(/<AuthLinksDesktop /);
    expect(code).toMatch(/<AuthLinksMobile \/>/);
    // The mobile pair must close the sheet on tap, like every other sheet link.
    const mobile = code.slice(code.indexOf('function AuthLinksMobile'), code.indexOf('export default function SiteHeader'));
    expect(mobile).toMatch(/<SheetClose asChild/);
  });

  it('shows a member Dashboard + Sign out, and treats an anonymous guest as a visitor', () => {
    expect(code).toMatch(/is_anonymous/);
    expect(code).toMatch(/DEFAULT_NEXT/);
    expect(code).toContain("const SIGN_OUT_HREF = '/logout'");
    expect(code).toMatch(/'member'/);
  });

  it('reads session state from the app-wide provider rather than opening a second client', () => {
    expect(code).toMatch(/CurrentUserContext/);
    expect(code).not.toMatch(/createBrowserClient\(/);
  });
});
