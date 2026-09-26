/**
 * @jest-environment node
 *
 * THE GUEST FUNNEL'S INSTRUMENTATION, AND A GUARD AGAINST THE WAY IT FAILED LAST TIME.
 *
 * ⚠️ The failure being prevented is not a bug in this file's logic — it is a wiring failure that
 * every unit test in the world would have passed. `guest_upgrade_events` had a schema, an admin
 * reader, and a writer component that **nothing imported**. The table read as instrumented and
 * recorded nothing for the entire life of the feature, while a green suite sat beside it.
 *
 * ⚠️ There is a second, subtler instance in the same story and it is the reason for the source
 * guards at the bottom. `EVENTS.GUEST_SIGNUP_CONFIRMED` has a test asserting its string value.
 * That test passes whether or not anything ever emits the event — it pins a constant, not a
 * behaviour. (That one turned out to be genuinely wired, on both auth branches; the point stands
 * that the test would not have told us either way.)
 *
 * So: unit-test the pure parts, and separately READ THE SOURCE to assert the emitters are actually
 * attached to the components a guest touches.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import {
  GUEST_FUNNEL_EVENTS,
  isGuestFunnelEvent,
  isGuestFunnelSurface,
  triggerReason,
} from '@/lib/analytics/guestFunnel';

const root = process.cwd();
/** ⚠️ Comments stripped — see test/stripComments.ts. The route's own comment says "no email". */
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));
/** The raw file, for the one assertion that is about a comment being gone (a deleted file). */
const readRaw = (p: string) => readFileSync(join(root, p), 'utf8');

describe('event + surface allowlists', () => {
  it('recognises every declared event and rejects anything else', () => {
    for (const e of GUEST_FUNNEL_EVENTS) expect(isGuestFunnelEvent(e)).toBe(true);
    for (const bad of ['', 'signup', 'SIGNUP_SUBMITTED', null, undefined, 42, {}]) {
      expect(isGuestFunnelEvent(bad)).toBe(false);
    }
  });

  // GUEST_SIGNUP_EVENT's `reason` is free-form — any caller can dispatch any string. An unvalidated
  // one would be rejected by the route's zod schema and the whole row would be lost, so an unknown
  // surface must degrade to 'modal' rather than poison the event.
  it('validates surfaces so an unknown reason cannot drop the row', () => {
    for (const s of ['banner', 'banner_inline', 'toolbar', 'publish', 'modal']) {
      expect(isGuestFunnelSurface(s)).toBe(true);
    }
    for (const bad of ['sidebar', 'Publish', '', null, undefined]) {
      expect(isGuestFunnelSurface(bad)).toBe(false);
    }
  });

  it('every surface a component actually dispatches is in the allowlist', () => {
    // If someone adds requestGuestSignup('onboarding') and forgets the allowlist, that click is
    // silently recorded as 'modal' and becomes invisible in the breakdown.
    const sources = [
      'components/admin/guest-publish-banner.tsx',
      'components/admin/templates/template-action-toolbar/versionsApi.ts',
      'components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx',
    ].map(read).join('\n');
    const dispatched = [...sources.matchAll(/requestGuestSignup\(\s*'([^']+)'/g)].map((m) => m[1]);
    expect(dispatched.length).toBeGreaterThan(0);
    for (const s of dispatched) expect(isGuestFunnelSurface(s)).toBe(true);
  });
});

describe('triggerReason', () => {
  it('joins surface and reason, and stays null when there is nothing to say', () => {
    expect(triggerReason('publish', null)).toBe('publish');
    expect(triggerReason('banner_inline', 'weak_password')).toBe('banner_inline:weak_password');
    expect(triggerReason(null, 'error')).toBe('error');
    expect(triggerReason(null, null)).toBeNull();
  });
});

describe('⚠️ the emitters are actually wired (the check a unit test cannot make)', () => {
  const BANNER = read('components/admin/guest-publish-banner.tsx');
  const BOX = read('components/admin/guest-signup-box.tsx');

  it('the banner emits the denominator on mount', () => {
    // Without prompt_shown, a zero click-through is unreadable: it means one thing if 40 people
    // saw the banner and something entirely different if it never rendered.
    expect(BANNER).toMatch(/trackGuestFunnel\('prompt_shown'/);
  });

  it('the banner records its own inline button', () => {
    // It opens the form locally instead of dispatching GUEST_SIGNUP_EVENT, so the modal's tracking
    // never sees it — the one click that has to be recorded at the call site.
    expect(BANNER).toMatch(/trackGuestFunnel\('signup_opened'.*banner_inline/s);
  });

  it('the form records the attempt, the send, and both ways it can fail', () => {
    expect(BOX).toMatch(/trackGuestFunnel\('signup_submitted'/);
    expect(BOX).toMatch(/trackGuestFunnel\('signup_email_sent'/);
    expect(BOX).toMatch(/trackGuestFunnel\('signup_failed'/);
    expect(BOX).toMatch(/trackGuestFunnel\('signup_existing_account'/);
  });

  it('records the attempt BEFORE validating the password', () => {
    // Counting only attempts that pass our own rules would hide the most actionable failure:
    // someone who wanted an account and our form turned them away.
    const submitted = BOX.indexOf("trackGuestFunnel('signup_submitted'");
    const pwCheck = BOX.indexOf('passwordProblem(password)');
    expect(submitted).toBeGreaterThan(-1);
    expect(pwCheck).toBeGreaterThan(-1);
    expect(submitted).toBeLessThan(pwCheck);
  });

  it('the modal emits on open', () => {
    expect(BOX).toMatch(/trackGuestFunnel\('signup_opened'/);
  });

  it('the dead writer is gone, so nothing looks instrumented that is not', () => {
    // components/admin/modals/upgrade-modal.tsx was the ONLY writer to guest_upgrade_events and
    // was imported nowhere. Deleted — this fails if it comes back.
    expect(() => readRaw('components/admin/modals/upgrade-modal.tsx')).toThrow();
  });

  it('the stripper left real code behind', () => {
    // ⚠️ Without this, a stripper that ate its input would make every assertion above pass against
    // an empty string — the silence-reads-as-success failure these guards exist to catch.
    expect(BANNER.length).toBeGreaterThan(1500);
    expect(BOX.length).toBeGreaterThan(2500);
    expect(BOX).toContain('supabase.auth.updateUser');
  });
});

describe('⚠️ no PII reaches the analytics row', () => {
  const BOX = read('components/admin/guest-signup-box.tsx');
  const ROUTE = read('app/api/guest/funnel/route.ts');
  const LIB = read('lib/analytics/guestFunnel.ts');

  it('never forwards the provider error message as a reason', () => {
    // Supabase puts the address into some auth error strings; `reason` is a closed set of three.
    expect(BOX).not.toMatch(/reason:\s*error\.message/);
    expect(BOX).not.toMatch(/reason:\s*[a-zA-Z]+\?\.\s*message/);
  });

  // ⚠️ MATCHES IDENTIFIERS, NOT THE WORD. The first version banned the token `password` anywhere
  // in a call and broke the moment a legitimate ENUM VALUE was named `method: 'password'` — a ban
  // on a token cannot tell a value from a name, the same failure as the `subscribe-and-save` check
  // that fired on the sentence denying it. What must never appear is the VARIABLE being passed:
  // `{ email }` shorthand or `something: addr`.
  it('never sends the email or password VALUE', () => {
    const calls = [...BOX.matchAll(/trackGuestFunnel\([^)]*\)/gs)].map((m) => m[0]).join('\n');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls).not.toMatch(/:\s*(email|addr|password)\b/); // key: <variable>
    expect(calls).not.toMatch(/\{\s*(email|addr|password)\s*[,}]/); // { email } shorthand
  });

  it('that PII check still rejects the thing it is for', () => {
    // Guard the guard: if the regexes above were loosened into uselessness, this fails.
    const bad = "trackGuestFunnel('x', { surface, email: addr })";
    expect(bad).toMatch(/:\s*(email|addr|password)\b/);
  });

  it('the route accepts no field that could carry an address', () => {
    expect(ROUTE).not.toMatch(/email/i);
  });

  it('sends the path only, never the query string', () => {
    // A query string can carry tokens; `location.search`/`href` must not be used.
    expect(LIB).toMatch(/window\.location\.pathname/);
    expect(LIB).not.toMatch(/location\.(search|href)/);
  });

  it('the user id comes from the session, never the request body', () => {
    expect(ROUTE).toMatch(/guest_user_id:\s*user\.id/);
    expect(ROUTE).not.toMatch(/guest_user_id:\s*(parsed|body)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Google sign-up for guests (2026-09-26). The button is inert until the Supabase
// provider is configured — verified that day: the authorize endpoint answers
// `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`.
// ─────────────────────────────────────────────────────────────────────────────
describe('⚠️ the guest Google path must LINK, never sign in afresh', () => {
  const BOX = stripComments(readRaw('components/admin/guest-signup-box.tsx'));

  it('uses linkIdentity', () => {
    expect(BOX).toMatch(/supabase\.auth\.linkIdentity\(/);
  });

  // THE ONE THAT MATTERS. `signInWithOAuth` starts a NEW session under a NEW uid, so the draft the
  // guest just spent an hour on belongs to the old user — orphaned and invisible. It is the exact
  // failure the file header warns about for /login, and it would look completely correct in review
  // because it is what the /login button does two files away.
  it('NEVER uses signInWithOAuth, which would orphan the draft', () => {
    expect(BOX).not.toMatch(/signInWithOAuth/);
  });

  it('is hidden unless the Supabase provider is actually configured', () => {
    // A button that 400s is worse than no button — the flag exists for that, not for a rollout.
    expect(BOX).toMatch(/googleAuthEnabled\(\)/);
  });

  it('keeps the email+password path intact', () => {
    expect(BOX).toMatch(/supabase\.auth\.updateUser\(/);
  });
});

describe('⚠️ every step carries its METHOD, or the button is unmeasurable', () => {
  const BOX = stripComments(readRaw('components/admin/guest-signup-box.tsx'));

  it('tags the google attempt and its failure', () => {
    expect(BOX).toMatch(/trackGuestFunnel\('signup_submitted', \{ surface, method: 'google' \}\)/);
    expect(BOX).toMatch(/method: 'google', reason: 'error'/);
  });

  it('tags the password path too, so the two can be compared', () => {
    // Tagging only the new path would make Google look like the only thing anyone ever tries.
    expect(BOX).toMatch(/method: 'password'/);
    const untagged = BOX.match(/trackGuestFunnel\('signup_(submitted|failed|email_sent|existing_account)'[^)]*\)/g) ?? [];
    expect(untagged.length).toBeGreaterThan(0);
    for (const call of untagged) expect(call).toMatch(/method:/);
  });

  it('triggerReason folds surface, method and reason in that order', () => {
    const { triggerReason } = require('@/lib/analytics/guestFunnel');
    expect(triggerReason('banner_inline', null, 'google')).toBe('banner_inline:google');
    expect(triggerReason('modal', 'weak_password', 'password')).toBe('modal:password:weak_password');
    expect(triggerReason(null, null, null)).toBeNull();
  });
});
