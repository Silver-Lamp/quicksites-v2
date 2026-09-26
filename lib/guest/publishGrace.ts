// lib/guest/publishGrace.ts
//
// PUBLISH FIRST, CONFIRM WITHIN A WEEK — the rule, and the two questions it turns on.
//
// ⚠️ THE PROBLEM THIS DOES **NOT** SOLVE, stated first so nobody mistakes it for the fix.
// 21 of 21 guest builders never typed an email at all. This removes friction at steps 3–6 of the
// sign-up (leave the tab → find the mail → click → come back), and **nobody has been observed
// reaching step 3.** On the mechanics alone it would be premature.
//
// ⚠️ THE REASON IT IS STILL WORTH IT IS THE PROMISE, NOT THE MECHANICS. The ask at step 1 is not
// just a form, it is what the form is understood to cost. "Sign up to publish" puts the reward
// behind an inbox; "publish now, confirm within a week to keep it" puts the reward first and the
// chore after. The keystrokes are identical; the bargain is not. That is a claim about behaviour,
// it is testable with the `method`/step events already recording, and it should be read off those
// rather than assumed — which is the whole reason the funnel went in first.
//
// ⚠️ NOINDEX WHILE THE CLOCK RUNS. A legitimate builder wants to see it live and send the link to
// one person; a spammer wants it indexed. Withholding indexing for a few days costs the first
// nothing (a week-old page ranks for nothing anyway) and removes most of what the second came for.
// So the grace window is generous on visibility and strict on distribution.

/** How long an unverified publish stays up. Owner-set: one week. */
export const PUBLISH_GRACE_DAYS = 7;
export const PUBLISH_GRACE_MS = PUBLISH_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type PublishGraceRow = {
  template_id: string;
  owner_id: string;
  expires_at: string;
  resolved_at: string | null;
  resolution: string | null;
};

/** When a publish made now would lapse. */
export function graceExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + PUBLISH_GRACE_MS);
}

/** Whole days left, floored at 0. What the banner counts down. */
export function daysLeft(expiresAt: string | Date, now: Date = new Date()): number {
  const end = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const ms = end.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * May this user publish without a confirmed email?
 *
 * ⚠️ A PENDING EMAIL CHANGE IS THE ENTIRE ENTRY TICKET, and it is doing more work than it looks.
 * It means they typed an address and chose a password — the step the whole funnel dies on. An
 * anonymous session with no pending address has committed nothing, and letting *that* publish
 * would hand anyone with a browser a live page on our domain, which is a different product.
 *
 * `pendingEmail` must come from the ADMIN user record (`auth.admin.getUserById(...).new_email`);
 * the session user object does not reliably carry it.
 */
export function mayPublishOnGrace(input: {
  isAnonymous: boolean;
  pendingEmail: string | null | undefined;
}): boolean {
  if (!input.isAnonymous) return true; // a confirmed account needs no grace
  return !!(input.pendingEmail && input.pendingEmail.trim());
}

/**
 * Should this expired row actually be unpublished?
 *
 * ⚠️ RE-CHECKED AGAINST THE USER, NEVER TRUSTED FROM THE ROW. Someone can confirm on another
 * device, or from a link opened a week later, and nothing writes back here in that moment. Taking
 * a site down from a stale row would unpublish a customer who did exactly what we asked — the one
 * outcome this feature cannot afford, since it is the honesty of the deadline that makes the
 * deadline acceptable.
 */
export function shouldExpire(input: {
  resolvedAt: string | null;
  expiresAt: string;
  ownerStillAnonymous: boolean;
  now?: Date;
}): boolean {
  if (input.resolvedAt) return false;
  if (!input.ownerStillAnonymous) return false; // they verified — nothing to do but resolve it
  const now = input.now ?? new Date();
  return new Date(input.expiresAt).getTime() <= now.getTime();
}
