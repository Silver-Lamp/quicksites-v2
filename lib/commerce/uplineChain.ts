// lib/commerce/uplineChain.ts
//
// MULTI-LEVEL UPLINE OVERRIDES. Pure arithmetic and graph-walking — no DB, no Stripe — so the
// payment path, the admin screens and the tests all agree by construction.
//
// ⚠️ WHY THIS EXISTS. `lib/commerce/orders.ts` §5b paid exactly ONE level: it read the selling
// code's `parent_code`, paid that code, and stopped. Owner direction 2026-09-23 is that the head of
// business development earns on everything downstream of her, which a single hop cannot express —
// if Amy recruits Daryle and Daryle recruits Bob, Bob's sale paid Daryle and Amy earned nothing.
//
// ⚠️ THE THING THAT MAKES THIS DANGEROUS IS NOT THE WALK, IT IS THE SUM. One level could be capped
// with `clampOverrideShare` (≤ QS_FEE_SHARE) and be safe by construction. N levels each capped at
// that same ceiling would pay N × the slice that exists, straight out of the house's pocket and then
// through the floor — a loss that grows with the depth of the tree and shows up as "revenue is down"
// rather than as an error. So the cap here is on the TOTAL across the chain, and it is the whole
// reason this is a module rather than a loop inline in the route.
//
// Nothing changes behaviour until rates are set: every `referral_codes.override_share` is 0 today, so
// the chain resolves and allocates nothing. That is deliberate — the mechanism can land before the
// compensation decisions do, and the compensation decisions are the owner's (docs/RENTAL_SPLITS.md).

/**
 * How far up a chain we will pay. A bound rather than a business rule: it stops one malformed row
 * from turning a paid order into an unbounded walk, and no real org chart is this deep.
 */
export const MAX_UPLINE_DEPTH = 8;

export type UplineLink = {
  code: string;
  /** This code's requested share OF THE PLATFORM FEE, as configured on its downline's row. */
  overrideShare: number;
};

/** What one code's row contributes to the walk. `undefined` from the lookup ends the chain. */
export type CodeNode = {
  parentCode: string | null;
  /** The share the PARENT earns when this code sells. Stored on the child, as today. */
  overrideShare: number;
};

/**
 * Walk from the selling code up through `parent_code`, nearest upline first.
 *
 * ⚠️ CYCLE DETECTION IS LOAD-BEARING, NOT DEFENSIVE. `parent_code` is a free-form string column with
 * no foreign key and no acyclicity constraint, and the two ways it gets written
 * (`/api/admin/referrals/set-hub` and `/api/partners/join`) neither of them check. So A→B→A is one
 * mistyped form field away, and without the `seen` set this function would loop forever *inside the
 * Stripe webhook handler* — every paid order hanging, money taken and no order marked paid. The
 * depth cap alone is not enough: a two-node cycle would still be walked `MAX_UPLINE_DEPTH` times and
 * pay the same code repeatedly.
 */
export function buildUplineChain(
  sellingCode: string,
  lookup: (code: string) => CodeNode | undefined,
  maxDepth: number = MAX_UPLINE_DEPTH
): UplineLink[] {
  const chain: UplineLink[] = [];
  const seen = new Set<string>([sellingCode]);
  let current = sellingCode;

  for (let depth = 0; depth < maxDepth; depth++) {
    const node = lookup(current);
    const parent = node?.parentCode;
    if (!node || !parent) break;
    // A code cannot pay itself, and a cycle must end the walk rather than repeat it.
    if (seen.has(parent)) break;
    seen.add(parent);
    chain.push({ code: parent, overrideShare: Number(node.overrideShare) || 0 });
    current = parent;
  }
  return chain;
}

export type UplinePayment = { code: string; cents: number; share: number };

export type UplineAllocation = {
  payments: UplinePayment[];
  /** Total paid across the chain. Never exceeds `availableShare` of the fee. */
  totalCents: number;
  /**
   * Codes whose configured share did not fit under the cap and were therefore paid NOTHING or less
   * than configured. ⚠️ Non-empty means somebody is owed a rate the order cannot pay — a
   * misconfiguration, and the caller should surface it rather than let it pass quietly.
   */
  shorted: { code: string; requestedShare: number; paidCents: number }[];
};

/**
 * Split the available slice of one platform fee across the chain.
 *
 * ⚠️ NEAREST-FIRST, AND A LEVEL THAT DOES NOT FIT IS PAID NOTHING RATHER THAN A REDUCED AMOUNT.
 *
 * The alternative — scale every level proportionally so the sum fits — is worse, and the reason is
 * the same reason `rentalSplits.ts` refuses to fund a manager's raise out of the closer's share:
 * a rate somebody agreed to must not quietly shrink because a level was added somewhere else in the
 * tree. Under proportional scaling, adding a grandparent silently cuts the direct manager's 25% that
 * was settled in writing, and nothing in the system would report that it happened.
 *
 * Nearest-first instead means the person closest to the sale — the one actually supporting that
 * account — is paid the rate they were promised, and pressure lands on the distant levels, where it
 * is visible as a `shorted` entry instead of an unexplained drop in someone's cheque.
 *
 * ⚠️ That has a consequence the owner must see rather than discover: if the direct upline's share
 * alone consumes the available slice, a head-of-BD sitting two levels up earns ZERO on that order.
 * The fix is a bigger slice (which costs the house) or smaller per-level rates — not a cleverer
 * allocator. See docs/RENTAL_SPLITS.md.
 */
export function allocateUplineOverrides(
  platformFeeCents: number,
  chain: readonly UplineLink[],
  /**
   * The share of `platformFeeCents` ALL uplines together may draw from.
   *
   * ⚠️ REQUIRED, NOT DEFAULTED, AND THAT IS DELIBERATE. It used to default to `QS_FEE_SHARE`,
   * which meant this module imported `partner-terms` and therefore read `QS_*` env — making it
   * unusable from a client bundle without silently falling back to defaults, and unusable by the
   * RENTAL rail, whose available slice is the house remainder rather than a fee share. Passing it
   * explicitly makes the module env-free and shared by both rails, and removes any chance of a
   * caller drawing against the wrong budget because a default looked reasonable.
   */
  availableShare: number
): UplineAllocation {
  const fee = Math.max(0, Math.floor(Number(platformFeeCents) || 0));
  const available = Math.max(0, Math.min(1, Number(availableShare) || 0));
  /**
   * ⚠️ ROUNDED, NOT FLOORED, AND THE REASON IS A ONE-CENT CLIFF THAT LOOKS EXACTLY LIKE A BUG.
   *
   * `QS_FEE_SHARE` is computed as `1 - PARTNER_FEE_SHARE`, which in floating point is
   * **0.19999999999999996**, not 0.2. Flooring the budget therefore gave $99.99 on a $500 fee, so a
   * perfectly sensible 10% + 10% configuration — summing to exactly the documented ceiling — missed
   * by a single cent and the FAR level was paid nothing at all. Found by running
   * `scripts/commission-scenarios.mts`, not by reasoning about it.
   *
   * Rounding costs at most a sub-cent of cap and makes exact configurations behave as written. The
   * cap exists to stop N levels each drawing a full slice; it was never about the last cent.
   */
  const budgetCents = Math.round(fee * available);

  const payments: UplinePayment[] = [];
  const shorted: UplineAllocation['shorted'] = [];
  let spent = 0;

  for (const link of chain) {
    const share = Math.max(0, Number(link.overrideShare) || 0);
    if (share <= 0) continue; // configured off — not a shortfall, just not participating
    const want = Math.floor(fee * share);
    const room = budgetCents - spent;
    if (want > 0 && want <= room) {
      payments.push({ code: link.code, cents: want, share });
      spent += want;
    } else {
      // Deliberately does NOT pay `room` here: a partial payment at an unagreed rate is the silent
      // dilution this function exists to avoid. Record it and pay nothing.
      shorted.push({ code: link.code, requestedShare: share, paidCents: 0 });
    }
  }

  return { payments, totalCents: spent, shorted };
}
