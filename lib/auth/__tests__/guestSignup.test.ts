/**
 * @jest-environment node
 */
// The guest → account path. 0 of 16 guest builders converted between July and 2026-09-13 because
// three surfaces each did part of the job and none finished it. These pin the whole path.
import { readFileSync } from 'node:fs';
import { editorPathFromPathname, guestSignupRedirectUrl, isNeedsSignup, passwordProblem, NEEDS_SIGNUP_CODE, GUEST_SIGNUP_EVENT } from '../guestSignup';

describe('pure pieces', () => {
  it('recognises a sign-up refusal by status AND code, so a real 401 stays a 401', () => {
    expect(isNeedsSignup(401, { code: 'needs_signup' })).toBe(true);
    expect(isNeedsSignup(401, { error: 'unauthorized' })).toBe(false);
    expect(isNeedsSignup(403, { code: 'needs_signup' })).toBe(false);
    expect(isNeedsSignup(401, null)).toBe(false);
  });
  it('finds the editor path and refuses the non-template admin routes', () => {
    expect(editorPathFromPathname('/admin/templates/abc-123')).toBe('/admin/templates/abc-123');
    expect(editorPathFromPathname('/admin/templates/abc-123/settings')).toBe('/admin/templates/abc-123');
    for (const p of ['/admin/templates/list', '/admin/templates/new', '/admin/growth', '/']) expect(editorPathFromPathname(p)).toBeNull();
  });
  it('⚠️ the confirmation link comes back to THEIR EDITOR via the callback — never the homepage', () => {
    expect(guestSignupRedirectUrl('https://www.quicksites.ai', '/admin/templates/abc')).toBe('https://www.quicksites.ai/auth/callback?next=%2Fadmin%2Ftemplates%2Fabc');
    expect(guestSignupRedirectUrl('https://www.quicksites.ai/', null)).toBe('https://www.quicksites.ai/auth/callback?next=%2Fadmin%2Ftemplates%2Flist');
  });
  it('a password is required and short ones are named', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/);
    expect(passwordProblem('long-enough')).toBeNull();
  });
});

describe('the route: ownership, not admin — and an anonymous owner is told to sign up', () => {
  const src = readFileSync('app/api/admin/sites/publish/route.ts', 'utf8');
  it('gates on requireTemplateOwner after the template id is known, and never on requireAdmin', () => {
    expect(src).not.toMatch(/requireAdmin\(/);
    const idCheck = src.indexOf("templateId required");
    const gate = src.indexOf('await requireTemplateOwner(templateId)');
    expect(idCheck).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(idCheck);
    expect(src).toMatch(/gate\.isAnonymous[\s\S]{0,120}code: NEEDS_SIGNUP_CODE[\s\S]{0,20}401/);
  });
  it('the owner gate reports anonymity', () => {
    const gate = readFileSync('lib/auth/requireTemplateOwner.ts', 'utf8');
    expect(gate).toMatch(/isAnonymous: !!user\.is_anonymous/);
    expect(NEEDS_SIGNUP_CODE).toBe('needs_signup');
  });
});

describe('the client: one event, one box, at the moment of intent', () => {
  it('every publish surface goes through publishSnapshot, which opens the box on needs_signup', () => {
    const api = readFileSync('components/admin/templates/template-action-toolbar/versionsApi.ts', 'utf8');
    expect(api).toMatch(/isNeedsSignup\(res\.status, json\)[\s\S]{0,80}requestGuestSignup\('publish'\)/);
    const editor = readFileSync('components/admin/templates/template-editor.tsx', 'utf8');
    expect(editor).toMatch(/await publishSnapshot\(/);
  });
  it('the always-visible toolbar has the BUTTON for a guest, and its toast says why', () => {
    const bar = readFileSync('components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx', 'utf8');
    expect(bar).toMatch(/\{isGuest && \([\s\S]{0,400}requestGuestSignup\('toolbar'\)[\s\S]{0,400}Sign up to publish/);
    expect(bar).toMatch(/toast\.error\(\(e as any\)\?\.message \|\| 'Failed to publish'\)/);
  });
  it('the guest shell mounts the modal, and the banner shares the same form', () => {
    expect(readFileSync('components/admin/admin-chrome.tsx', 'utf8')).toMatch(/<GuestSignupModal \/>/);
    const banner = readFileSync('components/admin/guest-publish-banner.tsx', 'utf8');
    // ⚠️ Matches the COMPONENT and the `compact` prop, not the exact tag text. The original
    // `<GuestSignupForm compact />` broke the moment the form gained a `surface` prop for the
    // funnel instrumentation — a true failure about nothing, since what this test cares about is
    // that the banner reuses the shared form rather than growing its own.
    expect(banner).toMatch(/<GuestSignupForm\b[^>]*\bcompact\b[^>]*\/>/);
    expect(banner).not.toMatch(/updateUser\(/); // the form logic lives in one place
  });
  it('the form upgrades IN PLACE with email + password and a redirect back to the editor', () => {
    const box = readFileSync('components/admin/guest-signup-box.tsx', 'utf8');
    expect(box).toMatch(/updateUser\(\{ email: addr, password \}, \{ emailRedirectTo \}\)/);
    expect(box).toMatch(/guestSignupRedirectUrl\(window\.location\.origin, editorPath\(\)\)/);
    expect(box).toMatch(new RegExp(`addEventListener\\(${GUEST_SIGNUP_EVENT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|addEventListener\\(GUEST_SIGNUP_EVENT`));
    expect(box).not.toMatch(/\/login\?(?!\$\{q)/); // never a bare /login for the upgrade path
  });
});
