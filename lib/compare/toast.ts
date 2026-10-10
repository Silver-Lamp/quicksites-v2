// lib/compare/toast.ts
//
// QuickSites vs Toast — for ONLINE ORDERING, which is the only thing we overlap on.
//
// Toast is a restaurant point-of-sale with online ordering bolted on; we are an ordering page
// with no point-of-sale at all. A page that pretends those are the same product is dishonest in
// both directions, so this module answers one narrow question: for a restaurant deciding how to
// take online orders, what does each cost per month, and at what volume does the answer flip?
//
// ⚠️ TWO CLASSES OF NUMBER, KEPT APART ON PURPOSE.
//   `published` — read on Toast's own pricing page (pos.toasttab.com/pricing) on the date below.
//   `reported`  — Toast does NOT publish these (processing rates, the online-ordering add-on, the
//                 per-order guest fee); the figures are from third-party guides and every surface
//                 that shows them says so. The two must never be rendered as one list, because the
//                 reader cannot tell a vendor figure from a blog figure by looking at it.
//
// ⚠️ THE BREAK-EVEN IS THE HONEST CLAIM, NOT "CHEAPER". Our restaurant fee is a percentage with a
// floor and no monthly; Toast's online channel is a lower percentage plus a monthly. Below some
// number of orders a month we cost less, above it Toast does. The page states that number for a
// few ticket sizes instead of a verdict. A test fails if the page ever says "cheaper than Toast"
// without the volume beside it.
//
// Our own figures are READ from pricingDefaults (the same constants the claim page shows), never
// retyped here. The fee is applied with the real `computePlatformFeeCents`, so the comparison uses
// the fee a merchant is actually charged — including the floor on small tickets.

import { computePlatformFeeCents } from '@/lib/commerce/fees';
import { RESTAURANT_FEE_MIN_CENTS, RESTAURANT_FEE_PERCENT } from '@/lib/commerce/pricingDefaults';

/** ISO date the Toast figures below were read. Bump when re-verified. */
export const TOAST_PRICES_VERIFIED = '2026-10-10';

export const TOAST = {
  name: 'Toast',
  slug: 'toast',
  category: 'restaurant point-of-sale with online ordering',
  oneLiner:
    'A full restaurant POS — terminals, kitchen screens, payroll — with online ordering as an add-on. Built for a restaurant that wants one vendor for everything.',

  /** Read on pos.toasttab.com/pricing, 2026-10-10. Plan prices only — Toast publishes nothing else. */
  published: {
    starterMonthly: 0,
    posMonthly: 69,
    bundleMonthly: 69,
    bundlePerEmployee: 9,
    /** Verbatim shape of what the page says about up-front cost. */
    upfront:
      'Hardware and implementation, which vary by package; 0% financing by application. The page does not state a figure.',
    contractNote: 'Toast does not state a contract term on its pricing page.',
  },

  /**
   * Third-party figures. Toast's pricing page publishes NONE of these; the online-ordering product
   * page says nothing about price; the delivery page says "a flat fee per order" without the fee.
   */
  reported: {
    cardPresentPct: 0.0249,
    cardPresentCents: 15,
    cardPresentStarterPct: 0.0309,
    onlinePct: 0.035,
    onlineCents: 15,
    onlineOrderingAddonMonthly: 75,
    /** Charged to the GUEST on each online order. $0.99 at launch (2023), $0.49 for some merchants. */
    guestFeeCentsLow: 49,
    guestFeeCentsHigh: 99,
    contractYears: '2–3',
  },

  sources: [
    { label: 'Toast pricing (vendor)', url: 'https://pos.toasttab.com/pricing', kind: 'vendor' as const },
    { label: 'Toast online ordering (vendor)', url: 'https://pos.toasttab.com/products/online-ordering', kind: 'vendor' as const },
    { label: 'Merchant Insiders — Toast fees (Feb 2026)', url: 'https://merchantinsiders.com/blogs/toast-fees/', kind: 'third-party' as const },
    { label: 'POS USA — Toast pricing', url: 'https://www.posusa.com/toast-pos-pricing/', kind: 'third-party' as const },
  ],
} as const;

export const QUICKSITES_RESTAURANT = {
  /** The same constants the claim page renders ("keep 92%, no monthly"). */
  feePercent: RESTAURANT_FEE_PERCENT,
  feeMinCents: RESTAURANT_FEE_MIN_CENTS,
  monthly: 0,
  /**
   * Card processing is inside the fee, not on top of it: orders run as destination charges
   * without `on_behalf_of` (the flag is off in production), so Stripe's fee comes out of our
   * share and the merchant's all-in cost is the platform fee alone.
   */
  processingIncluded: true,
} as const;

export type Volume = { orders: number; ticketCents: number };

/** What the RESTAURANT pays us in a month at this volume, in cents. */
export function quicksitesMonthlyCents({ orders, ticketCents }: Volume): number {
  const perOrder = computePlatformFeeCents({
    totalCents: ticketCents,
    collectFee: true,
    feePercent: QUICKSITES_RESTAURANT.feePercent,
    feeMinCents: QUICKSITES_RESTAURANT.feeMinCents,
  });
  return orders * perOrder + QUICKSITES_RESTAURANT.monthly * 100;
}

export type ToastMonthly = {
  /** Paid by the restaurant: online processing on every order + the add-on + the plan. */
  restaurantCents: number;
  /** Paid by the guest on top of their order (reported range, low end). */
  guestCents: number;
  /** The fixed part of restaurantCents, so a reader can see what volume amortises. */
  fixedCents: number;
};

/** What a Toast restaurant pays for its ONLINE channel in a month, using the reported figures. */
export function toastMonthly({ orders, ticketCents }: Volume, plan: 'starter' | 'pos' = 'starter'): ToastMonthly {
  const r = TOAST.reported;
  const planMonthly = plan === 'pos' ? TOAST.published.posMonthly : TOAST.published.starterMonthly;
  const fixedCents = (planMonthly + r.onlineOrderingAddonMonthly) * 100;
  const perOrder = Math.floor(ticketCents * r.onlinePct) + r.onlineCents;
  return {
    restaurantCents: orders * perOrder + fixedCents,
    guestCents: orders * r.guestFeeCentsLow,
    fixedCents,
  };
}

/**
 * Orders per month at which the restaurant-paid cost is the same on both — below it we cost
 * less, above it Toast does. `null` when our per-order fee is not above Toast's (then we are
 * cheaper at every volume, which with today's constants does not happen) or when the fixed part
 * is zero (nothing to amortise).
 */
export function breakEvenOrders(ticketCents: number, plan: 'starter' | 'pos' = 'starter'): number | null {
  const ours = quicksitesMonthlyCents({ orders: 1, ticketCents });
  const theirs = toastMonthly({ orders: 1, ticketCents }, plan);
  const theirPerOrder = theirs.restaurantCents - theirs.fixedCents;
  const delta = ours - theirPerOrder;
  if (delta <= 0 || theirs.fixedCents <= 0) return null;
  return Math.ceil(theirs.fixedCents / delta);
}

/** The ticket sizes the page tabulates. Cents. */
export const TICKETS_CENTS = [1500, 2500, 4000] as const;
/** The monthly volumes the page tabulates. */
export const VOLUMES = [25, 50, 100, 200, 400] as const;

export function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
export function pct(fraction: number): string {
  const n = fraction * 100;
  return `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
}
