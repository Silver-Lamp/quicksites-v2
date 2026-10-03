/**
 * @jest-environment node
 */
// lib/auth/__tests__/authProviders.test.ts
//
// "Continue with Google" is gated on the LIVE Supabase provider list, read at runtime. The
// build-time flag it replaced could be set with no provider behind it (every click 400s) or left
// unset with a working provider (a button nobody could see) — for eleven weeks it was the latter.
import fs from 'node:fs';
import path from 'node:path';
import { providersFromSettings } from '@/lib/auth/authProviders';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('providersFromSettings', () => {
  it('reads google from the external map', () => {
    expect(providersFromSettings({ external: { email: true, google: true } })).toEqual({
      google: true,
      email: true,
      source: 'supabase',
    });
  });

  it('is OFF when the provider is not enabled (the state verified 2026-10-03)', () => {
    expect(
      providersFromSettings({ external: { anonymous_users: true, email: true, google: false } }).google,
    ).toBe(false);
  });

  it('fails CLOSED on a malformed or empty payload — a button that 400s is worse than none', () => {
    for (const bad of [null, undefined, {}, { external: null }, 'nope', { external: 'x' }]) {
      const p = providersFromSettings(bad);
      expect(p.google).toBe(false);
      expect(p.email).toBe(true); // the password form has worked since July; it must not vanish
      expect(p.source).toBe('unavailable');
    }
  });

  it('the kill switch beats an enabled provider, and says so', () => {
    const p = providersFromSettings({ external: { email: true, google: true } }, true);
    expect(p.google).toBe(false);
    expect(p.source).toBe('kill_switch');
  });
});

// ⚠️ SOURCE GUARDS. The defect is a surface reading a flag instead of the live list, and no unit
// test of either surface can see which one it reads.
describe('both Google buttons read the live provider list', () => {
  it('/login gets providers from the server helper and never from the old flag', () => {
    const page = strip(read('app/login/page.tsx'));
    expect(page).toMatch(/getEnabledAuthProviders\(\)/);
    expect(page).toMatch(/providers=\{providers\}/);
    const form = strip(read('app/login/LoginForm.tsx'));
    expect(form).toMatch(/providers\?\.google === true/);
    expect(form).not.toMatch(/googleAuthEnabled/);
  });

  it('the guest sign-up box uses the client hook', () => {
    const box = strip(read('components/admin/guest-signup-box.tsx'));
    expect(box).toMatch(/useAuthProviders\(\)/);
    expect(box).not.toMatch(/googleAuthEnabled/);
  });

  it('the flag file is a kill switch only — nothing turns Google ON from env', () => {
    const flag = strip(read('lib/flags/googleAuth.ts'));
    expect(flag).toMatch(/googleAuthKillSwitch/);
    expect(flag).not.toMatch(/=== '1'/);
    // Nothing else in app/lib/components reads the env var directly.
    const files = ['app/login/LoginForm.tsx', 'components/admin/guest-signup-box.tsx', 'lib/auth/authProviders.ts'];
    for (const f of files) expect(strip(read(f))).not.toMatch(/NEXT_PUBLIC_GOOGLE_AUTH_ENABLED/);
  });

  it('the public route is cached, so a page of visitors is one upstream read', () => {
    const route = strip(read('app/api/auth/providers/route.ts'));
    expect(route).toMatch(/s-maxage=/);
    expect(route).toMatch(/getEnabledAuthProviders\(\)/);
  });
});
