import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  signInHref,
  signUpHref,
  AUTH_PATH,
  DEAD_AUTH_PATHS,
  NEXT_PARAM,
} from '@/lib/auth/authLinks';

describe('auth hrefs', () => {
  it('sends both actions to the one auth route', () => {
    expect(signInHref()).toBe('/login');
    expect(signUpHref()).toContain('/login');
    expect(signUpHref()).toContain('intent=signup');
  });

  it('carries a relative destination through', () => {
    expect(signInHref('/admin/templates/list')).toBe(
      `/login?${NEXT_PARAM}=%2Fadmin%2Ftemplates%2Flist`
    );
    // signUpHref already has a query string, so the separator must be & not ?
    expect(signUpHref('/merchant/audio')).toBe(
      `/login?intent=signup&${NEXT_PARAM}=%2Fmerchant%2Faudio`
    );
  });

  it('refuses an absolute or protocol-relative destination', () => {
    // Otherwise: sign the user in, then hand them to someone else's page. An open redirect
    // in an auth flow is worth more to an attacker than almost anywhere else.
    for (const evil of ['https://evil.example/x', '//evil.example/x', 'http://evil.example']) {
      expect(signInHref(evil)).toBe(AUTH_PATH);
      expect(signUpHref(evil)).not.toContain('evil.example');
    }
  });

  it('ignores empty or whitespace destinations rather than emitting next=', () => {
    expect(signInHref('')).toBe(AUTH_PATH);
    expect(signInHref('   ')).toBe(AUTH_PATH);
    expect(signInHref(null)).toBe(AUTH_PATH);
  });
});

describe('no component links to an auth route that does not exist', () => {
  // /register, /sign-up, /signup and /sign-in all 404'd in production while two upgrade
  // prompts linked to them — a visitor trying to pay us hit a dead end. They are redirected
  // now, but linking straight to /login is still the right thing to write.
  //
  // Read the files rather than shelling out to grep: the first version of this test used
  // execSync, the shell quoting broke, the command produced nothing, and the assertion
  // passed on an empty result. A guard that reports success when it fails to run is worse
  // than no guard.
  const ROOTS = ['app', 'components'];

  function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) sourceFiles(full, acc);
      else if (/\.tsx?$/.test(name) && !full.includes('__tests__')) acc.push(full);
    }
    return acc;
  }

  const files = ROOTS.flatMap((r) => sourceFiles(join(process.cwd(), r)));

  it('scans a real file set, so a clean result means something', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('finds no hardcoded dead auth path', () => {
    const dead = new RegExp(`['"\`](${DEAD_AUTH_PATHS.join('|')})(\\?|['"\`])`);
    const hits = files
      .filter((f) => dead.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(process.cwd() + '/', ''));
    expect(hits).toEqual([]);
  });

  it('would actually catch one — the regex is not inert', () => {
    // Proves the matcher works, so the clean result above is a finding rather than a shrug.
    const dead = new RegExp(`['"\`](${DEAD_AUTH_PATHS.join('|')})(\\?|['"\`])`);
    expect(dead.test(`window.location.href = '/register';`)).toBe(true);
    expect(dead.test(`href="/sign-up?redirect_url=x"`)).toBe(true);
    expect(dead.test(`href="/login"`)).toBe(false);
  });
});
