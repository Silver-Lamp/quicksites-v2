/**
 * @jest-environment node
 *
 * THE CLAIM FUNNEL'S WIRING — and, more importantly, the reason it does not use PostHog.
 *
 * ⚠️ `captureServer` was the obvious home for these events and would have looked complete. But
 * PostHog has NEVER been configured in production (`vercel env ls production` returns zero
 * entries), and `captureServer` returns early without a key — so all 33 existing call sites across
 * 24 files write to nothing, including the entire Model A money funnel. Instrumenting this funnel
 * there would have been the third measurement built into silence in a single day.
 *
 * These are source guards. A unit test cannot tell you that the emitter is attached to the page a
 * stranger actually loads, and "attached to the right thing" is the property that keeps failing
 * here — a dead component, an unset key, a constant with a test on the constant.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import { CLAIM_FUNNEL_EVENTS } from '@/lib/analytics/claimFunnel';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

const LIB = read('lib/analytics/claimFunnel.ts');
const PAGE = read('app/claim-site/[id]/page.tsx');
const START = read('app/api/claim-draft/[id]/route.ts');
const COMPLETE = read('lib/auth/claimPendingSiteDraft.ts');

describe('the stripper left real code', () => {
  it('did not eat the files', () => {
    expect(LIB.length).toBeGreaterThan(800);
    expect(PAGE.length).toBeGreaterThan(1500);
    expect(COMPLETE).toContain('claim_operator_draft');
  });
});

describe('⚠️ the table is the sink, not PostHog', () => {
  it('writes to claim_funnel_events', () => {
    expect(LIB).toMatch(/from\('claim_funnel_events'\)/);
    expect(LIB).toMatch(/\.insert\(/);
  });

  it('uses the service-role admin client, so no RLS policy or grant can silently refuse it', () => {
    expect(LIB).toMatch(/supabaseAdmin/);
  });

  it('logs a failed insert instead of swallowing it', () => {
    // An insert that fails quietly is the exact bug this funnel exists to end.
    expect(LIB).toMatch(/console\.error\('\[claim-funnel\]/);
  });

  it('still mirrors to PostHog, so the events exist the day a key is set', () => {
    expect(LIB).toMatch(/captureServer\(/);
  });
});

describe('⚠️ every step is attached to the surface a stranger touches', () => {
  it('the claim page records both the offer and the dead end', () => {
    expect(PAGE).toMatch(/recordClaimStep\(/);
    expect(PAGE).toMatch(/claim_page_viewed/);
    expect(PAGE).toMatch(/claim_page_dead_end/);
  });

  it('the page records BEFORE its early return, or the dead end is never counted', () => {
    // `if (!claimable) return <This link is no longer available>` sits below it. Recording after
    // that return would count only the happy path — the one case that already leaves a trace.
    const call = PAGE.indexOf('recordClaimStep(');
    const earlyReturn = PAGE.indexOf('if (!claimable)');
    expect(call).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(call).toBeLessThan(earlyReturn);
  });

  it('the claim-start route records the press and the token refusal separately', () => {
    expect(START).toMatch(/recordClaimStep\('claim_started'/);
    expect(START).toMatch(/recordClaimStep\('claim_page_dead_end'.*bad_token/s);
  });

  it('completion is recorded only when ownership ACTUALLY transferred', () => {
    // The RPC no-ops on an already-claimed draft. Counting the call rather than the result would
    // turn one leaked link opened twice into two claims.
    const branch = COMPLETE.indexOf('transferred === true');
    const done = COMPLETE.indexOf("recordClaimStep('claim_completed'");
    expect(branch).toBeGreaterThan(-1);
    expect(done).toBeGreaterThan(branch);
  });
});

describe('⚠️ no PII, and the two refusals stay distinct', () => {
  it('records nothing that identifies a person', () => {
    // The unit is a STEP: a template id, an optional prospect id, a coarse reason.
    for (const bad of [/email/i, /phone/i, /business_name/, /\btoken\b/]) {
      expect(LIB).not.toMatch(bad);
    }
  });

  it('keeps bad_token separate from not_claimable', () => {
    // A broken link of OURS and a draft that is genuinely gone are opposite problems; collapsing
    // them would hide the first behind the second.
    expect(PAGE).toMatch(/bad_token/);
    expect(PAGE).toMatch(/not_claimable/);
  });

  it('declares exactly the four steps', () => {
    expect([...CLAIM_FUNNEL_EVENTS]).toEqual([
      'claim_page_viewed',
      'claim_page_dead_end',
      'claim_started',
      'claim_completed',
    ]);
  });
});

describe('⚠️ PostHog has a config gate now', () => {
  const HEALTH = read('lib/config/health.ts');
  it('declares the posthog gate, so /status can say it is missing', () => {
    // Without this, an entire analytics layer can be absent in production and nothing reports it —
    // which is what happened, for the life of the feature.
    expect(HEALTH).toMatch(/key: 'posthog'/);
    expect(HEALTH).toMatch(/POSTHOG_KEY/);
  });
  it('does not require POSTHOG_HOST, which has a code default', () => {
    // Requiring a key with a fallback makes a correct deploy report incomplete — a check that cries
    // wolf trains people to ignore it.
    expect(HEALTH).not.toMatch(/requires: \[[^\]]*POSTHOG_HOST/);
  });
});
