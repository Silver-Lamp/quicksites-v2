/**
 * @jest-environment node
 */
// The number that says whether the builder's front door works. On 2026-09-13: 16 · 47 · 7 · 0 · 0 · 0.
import { readFileSync } from 'node:fs';
import { computeGuestFunnel, EMPTY_GUEST_FUNNEL, type GuestTemplateRow, type GuestUserRow } from '../guestFunnel';

const guest = (id: string, over: Partial<GuestUserRow> = {}): GuestUserRow => ({ id, created_at: '2026-09-01T00:00:00Z', last_sign_in_at: '2026-09-01T00:00:00Z', is_anonymous: true, ...over });
const site = (id: string, owner: string, over: Partial<GuestTemplateRow> = {}): GuestTemplateRow => ({ id, owner_id: owner, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:05:00Z', claim_source: 'guest_build', ...over });

describe('computeGuestFunnel', () => {
  it('counts each stage from the rows', () => {
    const guests = [
      guest('g1'),
      guest('g2', { last_sign_in_at: '2026-09-03T00:00:00Z' }), // came back
      guest('g3', { new_email: 'x@y.com' }), // started sign-up
    ];
    const sites = [
      site('s1', 'g1', { updated_at: '2026-09-01T00:30:00Z', rebuilt_from: 'https://a.com/' }), // engaged, from a URL
      site('s2', 'g2', { has_contact: true }),
      site('s3', 'g3'),
      site('s4', 'converted-owner'), // owner no longer anonymous → converted
      site('s5', 'g1', { claim_source: 'listing_import' }), // not a guest build
    ];
    expect(computeGuestFunnel(guests, sites)).toEqual({
      guests: 3, sites: 4, builders: 4, editedTenMinPlus: 1, returned: 1, startedSignup: 1, converted: 1,
      withSourceUrl: 1, withContact: 1, newestSiteAt: '2026-09-01T00:00:00Z',
      // No events passed → null, meaning "not read". Deliberately not a zeroed object: see the
      // field's note in guestFunnel.ts.
      steps: null,
    });
  });
  it('an empty world is the empty funnel', () => {
    expect(computeGuestFunnel([], [])).toEqual(EMPTY_GUEST_FUNNEL);
  });
  it('the engagement threshold is ten minutes, measured on the site not the session', () => {
    const g = [guest('g')];
    expect(computeGuestFunnel(g, [site('a', 'g', { updated_at: '2026-09-01T00:09:59Z' })]).editedTenMinPlus).toBe(0);
    expect(computeGuestFunnel(g, [site('a', 'g', { updated_at: '2026-09-01T00:10:00Z' })]).editedTenMinPlus).toBe(1);
  });
});

describe('wired into the ops dashboard', () => {
  it('the snapshot carries guestFunnel and the dashboard renders every stage with a link to /admin/users', () => {
    const snap = readFileSync('lib/ops/opsSnapshotServer.ts', 'utf8');
    expect(snap).toMatch(/guestFunnel: GuestFunnel/);
    expect(snap).toMatch(/loadGuestFunnel\(\)/);
    const ui = readFileSync('components/admin/ops-dashboard-client.tsx', 'utf8');
    // ⚠️ "Started sign-up" was renamed to "Awaiting confirm" on 2026-09-27 — it counts a PENDING
    // state (unconfirmed `new_email`) that a successful signup clears, so the old label showed 0
    // exactly when the flow first worked. See the describe block at the foot of this file.
    for (const label of ['Guests', 'Edited 10+ min', 'Came back', 'Awaiting confirm', 'Converted']) expect(ui).toContain(`label="${label}"`);
    // "Reachable" is a tile + panel unit that lives with the panel (guest-leads-panel.tsx).
    expect(ui).toMatch(/<GuestReachableTile funnel=\{guestFunnel\} \/>/);
    expect(ui).toMatch(/href="\/admin\/users"/);
    expect(ui).toMatch(/npm run guests:contacts/);
  });
  it('the loader never throws — the dashboard renders with an empty funnel instead', () => {
    const src = readFileSync('lib/admin/guestFunnelServer.ts', 'utf8');
    expect(src).toMatch(/catch[\s\S]*return EMPTY_GUEST_FUNNEL/);
  });
});

// ⚠️ Added 2026-09-25 with the pre-submit instrumentation. The distinction these cover is the
// whole point of the feature: an UNREAD events table and an EMPTY one are different answers, and
// collapsing them is how "0 started sign-up" read as a finding for two months.
describe('computeGuestFunnelSteps', () => {
  const { computeGuestFunnelSteps } = require('@/lib/admin/guestFunnel');

  it('counts each step, and counts PEOPLE separately from clicks', () => {
    const rows = [
      { event: 'prompt_shown', guest_user_id: 'a' },
      { event: 'prompt_shown', guest_user_id: 'a' }, // same person, two page loads
      { event: 'signup_opened', guest_user_id: 'a' },
      { event: 'signup_opened', guest_user_id: 'a' }, // opened twice
      { event: 'signup_opened', guest_user_id: 'b' },
      { event: 'signup_submitted', guest_user_id: 'b' },
      { event: 'signup_failed', guest_user_id: 'b' },
      { event: 'signup_submitted', guest_user_id: 'b' },
      { event: 'signup_email_sent', guest_user_id: 'b' },
    ];
    const s = computeGuestFunnelSteps(rows);
    expect(s.promptShown).toBe(2);
    expect(s.signupOpened).toBe(3);
    expect(s.signupSubmitted).toBe(2);
    expect(s.signupEmailSent).toBe(1);
    expect(s.signupFailed).toBe(1);
    // Two clicks from one person is one person. Reading 3 "opened" as 3 interested builders would
    // overstate the top of the funnel and make the drop-off below it look worse than it is.
    expect(s.buildersWhoOpened).toBe(2);
  });

  it('a prompt impression alone is not a builder who engaged', () => {
    const s = computeGuestFunnelSteps([
      { event: 'prompt_shown', guest_user_id: 'a' },
      { event: 'prompt_shown', guest_user_id: 'b' },
    ]);
    expect(s.promptShown).toBe(2);
    expect(s.buildersWhoOpened).toBe(0);
  });

  it('an empty read is all zeroes — which is a real answer, unlike null', () => {
    const s = computeGuestFunnelSteps([]);
    expect(s.promptShown).toBe(0);
    expect(s.buildersWhoOpened).toBe(0);
  });
});

/**
 * ⚠️ "AWAITING CONFIRM" IS A PENDING STATE, NOT A FUNNEL STEP — and the tile said otherwise.
 *
 * `startedSignup` counts guests whose `new_email` is unconfirmed, so CONFIRMING CLEARS IT. It was
 * rendered as "Started sign-up" with a warn tone at zero, which meant that on 2026-09-27 — the
 * first time anyone ever completed guest signup — the dashboard read "Started sign-up 0 ⚠" next
 * to "Converted 1 ✓". A true number answering a different question, and it looked worst exactly
 * when the thing finally worked.
 *
 * These pin the distinction rather than the wording: the cumulative step is `signupSubmitted`,
 * and a successful conversion must not make the pending count look like a failure.
 */
describe('pending confirmations are not the same as signups started', () => {
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'components/admin/ops-dashboard-client.tsx'),
    'utf8',
  );
  const stripped = require('@/test/stripComments').stripComments(src);

  it('the tile no longer claims to count sign-ups started', () => {
    expect(stripped).not.toContain('label="Started sign-up"');
  });

  it('zero pending is not a warning once something has been submitted', () => {
    // The old expression was a bare `startedSignup > 0 ? 'good' : 'warn'`.
    expect(stripped).not.toMatch(/guestFunnel\.startedSignup > 0 \? 'good' : 'warn'/);
    // It must consult the cumulative step before calling zero a problem.
    const i = stripped.indexOf('guestFunnel.startedSignup');
    const window = stripped.slice(i, i + 600);
    expect(window).toContain('signupSubmitted');
  });

  it('the cumulative step is still rendered somewhere', () => {
    // Relabelling the pending tile must not leave the funnel with no "submitted" number at all.
    expect(stripped).toContain('steps.signupSubmitted');
  });
});

/**
 * ⚠️ THE FUNNEL NOW RUNS PAST CONFIRMATION, because ending there hid the real last step.
 *
 * On 2026-09-26 the first person ever to complete guest sign-up confirmed their email in 53
 * seconds — and never published. A day later `templates.published` was still false. Nothing
 * recorded that, so "converted 1" read as the finish line when the site was not live.
 *
 * `publish_blocked` / `published` / `published_on_grace` are written SERVER-side at the moment
 * the publish resolves. A browser beacon claiming a site went live is the one event in this
 * funnel actually worth forging, which is why the public route refuses them.
 */
describe('the publish steps', () => {
  const { computeGuestFunnelSteps } = require('../guestFunnel');

  it('counts refusals, publishes and grace publishes separately', () => {
    const rows = [
      { event: 'published', guest_user_id: 'a' },
      { event: 'published', guest_user_id: 'b' },
      { event: 'published_on_grace', guest_user_id: 'c' },
      { event: 'publish_blocked', guest_user_id: 'd' },
    ];
    const s = computeGuestFunnelSteps(rows);
    expect(s.published).toBe(2);
    expect(s.publishedOnGrace).toBe(1);
    expect(s.publishBlocked).toBe(1);
  });

  it('does NOT fold a grace publish into published', () => {
    // A site live on a 7-day clock is a promise with a deadline. Counting the two together
    // would overstate how many sites are safely live.
    const s = computeGuestFunnelSteps([{ event: 'published_on_grace', guest_user_id: 'a' }]);
    expect(s.published).toBe(0);
    expect(s.publishedOnGrace).toBe(1);
  });
});

describe('the browser cannot claim a site went live', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('@/test/stripComments');
  const route = stripComments(
    fs.readFileSync(path.join(process.cwd(), 'app/api/guest/funnel/route.ts'), 'utf8'),
  );
  const publish = stripComments(
    fs.readFileSync(path.join(process.cwd(), 'app/api/admin/sites/publish/route.ts'), 'utf8'),
  );

  it('the public beacon route rejects the server-only events', () => {
    expect(route).toContain('isServerOnlyGuestEvent');
  });

  it('the publish route records them itself, at both outcomes', () => {
    expect(publish).toContain("recordGuestPublishEvent('publish_blocked'");
    expect(publish).toMatch(/recordGuestPublishEvent\(\s*graceUntil \? 'published_on_grace' : 'published'/);
  });

  it('never awaits the recorder — instrumentation must not break a publish', () => {
    // A publish that 500s because an analytics insert failed turns "we cannot see the last step"
    // into "the last step does not work".
    for (const m of publish.match(/recordGuestPublishEvent\(/g) ?? []) void m;
    expect(publish).not.toMatch(/await recordGuestPublishEvent/);
    expect(publish).toMatch(/void recordGuestPublishEvent/);
  });
});
