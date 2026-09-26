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
    // ⚠️ The rule changed on 2026-09-26 and this assertion now states the NEW one rather than a
    // character distance. An anonymous owner is no longer refused outright: one who has set an
    // email + password publishes on a 7-day clock (lib/guest/publishGrace.ts), and only one who
    // has committed NOTHING is sent to sign up. The old regex required the refusal to sit within
    // 120 characters of the branch, so it failed on the grace logic being inserted between them —
    // a true failure about nothing, which is the shape a proximity check tends to produce.
    expect(src).toMatch(/gate\.isAnonymous/);
    expect(src).toMatch(/mayPublishOnGrace\(/);
    expect(src).toMatch(/code: NEEDS_SIGNUP_CODE[\s\S]{0,20}401/);
    // The refusal must still be reachable — i.e. guarded by the grace check, not deleted.
    const graceCheck = src.indexOf('mayPublishOnGrace(');
    const refusal = src.indexOf('NEEDS_SIGNUP_CODE }, 401');
    expect(graceCheck).toBeGreaterThan(0);
    expect(refusal).toBeGreaterThan(graceCheck);
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

// ⚠️ The guest tray, decluttered 2026-09-26. A first-time builder who has typed only a business
// name was getting the full owner cockpit: two controls that both hide the toolbar (a gear that
// looks like settings, and a labelled "Hide"), page settings for a site with one page, a "Draft"
// badge competing with "Sign up to publish", and a reassurance line squeezed until it wrapped one
// word per line.
describe('the bottom tray is simpler for a guest', () => {
  const { stripComments } = require('@/test/stripComments');
  const src = stripComments(
    readFileSync('components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx', 'utf8'),
  );

  it('reads a real file', () => {
    expect(src.length).toBeGreaterThan(8000);
    expect(src).toContain('setToolbarCollapsed');
  });

  it('shows only ONE way to hide the toolbar for a guest', () => {
    // Both the gear and the labelled button call setToolbarCollapsed(true). The gear is now
    // owner-only; the one that says "Hide" is what a guest gets.
    const collapses = src.match(/setToolbarCollapsed\(true\)/g) ?? [];
    expect(collapses.length).toBeGreaterThanOrEqual(2); // both still exist for owners
    expect(src).toMatch(/\{!isGuest && \([\s\S]{0,400}Hide toolbar \(T\)/);
  });

  it('hides page settings and the draft badge from a guest', () => {
    expect(src).toMatch(/\{!isGuest && \([\s\S]{0,300}Page Settings/);
    expect(src).toMatch(/\{!isGuest && \([\s\S]{0,300}bg-yellow-600/);
  });

  it('keeps the guest sign-up button — the one control that matters', () => {
    expect(src).toMatch(/isGuest && \([\s\S]{0,400}Sign up to publish/);
  });

  it('does not let the save reassurance wrap', () => {
    expect(src).toMatch(/whitespace-nowrap">Saved · yours when you sign up/);
  });
});
