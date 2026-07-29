// lib/prospects/orderingFit.ts
//
// Is this restaurant a fit for an ORDERING directory?
//
// <city>-restaurant.com exists to send someone to a kitchen they can order from. A buffet is
// a dine-in business by construction: the product is the room and the refill, not a packed
// container. Nobody phones a buffet for a takeaway, so listing one on an ordering directory
// wastes the slot and slightly misleads the diner — and the funnel behind it (claim → connect
// payments → take a per-order fee) has nothing to bite on, because there are no orders.
//
// This is a FIT judgement, not a quality one. A buffet is not a worse restaurant; it is a
// worse fit for this particular surface. Their site still exists and still works — it is
// simply not advertised as somewhere to place an order.
//
// Deliberately narrow: name and category signals only, no LLM. An operator can always
// override by selecting them anyway; this stops the obvious cases reaching a public list.

export type OrderingFitInput = {
  name?: string | null;
  /** Google Places types or humanized category labels — either form works. */
  categories?: string[] | null;
};

export type OrderingFitResult = {
  fits: boolean;
  /** Present when `fits` is false — short, human, safe to print in an operator log. */
  reason?: string;
};

/**
 * `buffet` as a whole word, but NOT `buffett`.
 *
 * "Buffett" is a surname — Margaritaville trades on it, and a Jimmy Buffett themed bar is a
 * perfectly normal takeaway restaurant. A naive substring match would silently drop it, which
 * is the kind of quiet wrong answer that is hard to notice on a list you never see.
 */
const BUFFET_NAME = /\bbuffets?\b/i;
const BUFFETT_NAME = /\bbuffett/i;

/** "All you can eat" is the same business model wearing a different name. */
const AYCE_NAME = /\ball[-\s]?you[-\s]?can[-\s]?eat\b/i;

const BUFFET_CATEGORY = /buffet/i;

export function isBuffetLike(input: OrderingFitInput): boolean {
  const name = String(input.name ?? '');
  if (BUFFETT_NAME.test(name)) return false; // surname, not a service model
  if (BUFFET_NAME.test(name) || AYCE_NAME.test(name)) return true;
  return (input.categories ?? []).some((c) => BUFFET_CATEGORY.test(String(c ?? '')));
}

/**
 * Should this business appear on a city ORDERING directory?
 *
 * Returns a reason when it shouldn't, so the caller can log WHY a stop vanished from a list
 * rather than leaving an operator to wonder where it went.
 */
export function assessOrderingFit(input: OrderingFitInput): OrderingFitResult {
  if (isBuffetLike(input)) {
    return {
      fits: false,
      reason: 'buffet / all-you-can-eat — a dine-in model, so an ordering list is the wrong surface',
    };
  }
  return { fits: true };
}
