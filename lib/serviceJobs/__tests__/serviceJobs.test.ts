/**
 * @jest-environment node
 */

/**
 * ⚠️ WHY THIS FILE EXISTS.
 *
 * SecondSet shipped four tables, nine routes and six lib modules with ZERO tests, on a surface that
 * (a) records a third party in their own driveway and (b) drives an approve-the-bill decision. It
 * is flag-gated off and has never met a real shop, so nothing has gone wrong — which is the only
 * reason there is still time to write these.
 *
 * Almost everything here is a database call, so the coverage that matters is NOT "call the function
 * and see". It is the two kinds of thing a unit test would miss:
 *
 *   1. The rollup rule, extracted as a pure function so it can be argued with.
 *   2. SOURCE GUARDS over the security and privacy invariants — a deleted `.eq('job_id', jobId)` or
 *      a dropped expiry check still compiles, still passes any mocked test, and is a live hole.
 *      Reading the file catches it; exercising a mock does not. Same pattern as
 *      `lib/resumes/__tests__/versions.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextJobStatus } from '@/lib/serviceJobs/serviceJobs';

const src = (f: string) => readFileSync(join(process.cwd(), 'lib/serviceJobs', f), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('rolling line-item decisions up into a job status', () => {
  const li = (...statuses: string[]) => statuses.map((status) => ({ status }));

  it('stays awaiting while anything is still proposed', () => {
    expect(nextJobStatus(li('approved', 'proposed'))).toBe('awaiting_approval');
    expect(nextJobStatus(li('declined', 'proposed'))).toBe('awaiting_approval');
    expect(nextJobStatus(li('proposed'))).toBe('awaiting_approval');
  });

  it('is approved when the customer approved anything and nothing is pending', () => {
    expect(nextJobStatus(li('approved'))).toBe('approved');
    // ⚠️ Partial approval is APPROVED, not declined: the customer said yes to some work, and the
    // shop is authorised to do that work. Reading a partial as a refusal would stop a job the
    // customer agreed to.
    expect(nextJobStatus(li('approved', 'declined'))).toBe('approved');
  });

  it('is declined only when everything settled and none of it was approved', () => {
    expect(nextJobStatus(li('declined'))).toBe('declined');
    expect(nextJobStatus(li('declined', 'declined'))).toBe('declined');
  });

  // ⚠️ Known and deliberate, pinned so a change is a decision rather than a drift: a job with no
  // line items reads as `declined`. It is the honest reading of "nothing was approved", but it
  // means an empty job created by mistake presents to the shop as a customer REFUSAL.
  it('treats a job with no line items as declined', () => {
    expect(nextJobStatus([])).toBe('declined');
  });

  it('ignores statuses it does not know rather than guessing', () => {
    expect(nextJobStatus(li('weird'))).toBe('declined');
    expect(nextJobStatus(li('weird', 'approved'))).toBe('approved');
  });
});

describe('a customer holding one job token cannot touch another job', () => {
  // The portal is public — the unguessable `public_token` IS the credential. So the line-item
  // update must be scoped by BOTH id and job, or anyone with any valid token can approve or
  // decline line items on somebody else's repair by guessing an id.
  const code = stripComments(src('serviceJobs.ts'));

  it('scopes the line-item update to the job, not just the line-item id', () => {
    const update = code.slice(code.indexOf('applyCustomerDecision'));
    expect(update).toContain(".eq('id', d.lineItemId)");
    expect(update).toContain(".eq('job_id', jobId)");
  });
});

describe('the glasses capture token expires; the customer portal token does not', () => {
  const code = stripComments(src('serviceJobs.ts'));

  // A capture token authorises RECORDING. It is minted per job with a TTL, and a resolver that
  // stopped checking the expiry would leave a camera credential valid forever.
  it('rejects an expired capture token', () => {
    const fn = code.slice(code.indexOf('getJobByCaptureToken'), code.indexOf('getJobByPublicToken'));
    expect(fn).toContain('capture_token_expires_at');
    expect(fn).toMatch(/< *Date\.now\(\)/);
    expect(fn).toContain('return null');
  });

  // ⚠️ Deliberate asymmetry, recorded so it is not "fixed" by accident: the PUBLIC token has no
  // expiry because it is the customer's link to their own job and must keep working. Adding a TTL
  // there would silently break a customer's access to a decision they have not made yet.
  it('does not expire the public portal token', () => {
    const fn = code.slice(code.indexOf('getJobByPublicToken'), code.indexOf('getJobDetail'));
    expect(fn).not.toContain('expires_at');
  });
});

describe('capture ingest refuses a job the customer has not consented to', () => {
  const code = stripComments(src('captureRail.ts'));

  // ⚠️ This gate did not exist until 2026-09-24. Captures were stored because a TECH had a valid
  // grant — but HJ's rail enforces that the WEARER is bound, which is the tech agreeing to be
  // recorded, not the customer agreeing to be. Two different consents.
  it('checks consent_captured_at before storing', () => {
    expect(code).toContain('consent_captured_at');
    expect(code).toContain('refusedNoConsent');
  });

  // ⚠️ Refused captures must NOT be acked. Acking drops them off the rail permanently, so a
  // customer who consents ten minutes later would lose the photos — destroying evidence the shop
  // may legitimately need, to enforce a rule that has not been broken yet.
  it('skips rather than acks when consent is missing', () => {
    const gate = code.slice(code.indexOf('refusedNoConsent++'));
    expect(gate.slice(0, 40)).toContain('continue');
  });

  // ⚠️ The gate lives in the pull loop, NOT inside addCapture, because the catch around addCapture
  // swallowed everything as "unique conflict" and then acked. A privacy gate that throws through a
  // bare catch is a privacy gate that silently deletes the capture — the rank-sync failure in
  // CLAUDE.md, with worse consequences.
  it('only swallows a duplicate-key error, and re-raises anything else', () => {
    expect(code).toMatch(/isDuplicate/);
    expect(code).toMatch(/if \(!isDuplicate\) throw/);
  });
});

describe('the flag really does gate it', () => {
  // Every surface is inert until SECONDSET_ENABLED. If the sync entry point stopped checking, a
  // partner grant alone would start pulling captures on a product nobody has greenlit.
  it('the rail sync refuses to run when the feature is off', () => {
    const code = stripComments(src('captureRail.ts'));
    expect(code).toContain('SECONDSET_ENABLED');
    expect(code).toContain("skipped: 'not_enabled'");
  });
});
