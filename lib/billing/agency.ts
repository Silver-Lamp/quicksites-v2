// lib/billing/agency.ts
//
// Agency-plan Stripe wiring (Path B): build the per-user + per-site subscription
// line items at checkout, and keep the per-site quantity in sync with the user's
// actual published-site count.

import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { agencyStripeConfig, countBillableSites, type AgencyTier } from '@/lib/billing/plans';

type AnyClient = SupabaseClient<any, any, any>;

/**
 * Build the subscription line items for an agency checkout: one platform line
 * (quantity 1) + one per-site line (quantity = #sites, min 1). Throws if the
 * required price IDs aren't configured.
 */
export function buildAgencyLineItems(
  sites: number
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const { platformPriceId, perSitePriceId } = agencyStripeConfig();
  if (!platformPriceId || !perSitePriceId) {
    throw new Error(
      'Agency prices not configured (STRIPE_PRICE_AGENCY_PLATFORM / STRIPE_PRICE_AGENCY_PERSITE)'
    );
  }
  const siteQty = Math.max(1, Math.floor(Number(sites) || 1));
  return [
    { price: platformPriceId, quantity: 1 },
    { price: perSitePriceId, quantity: siteQty },
  ];
}

/** Founder discount config for a checkout session (discounts XOR promo codes). */
export function agencyDiscountConfig(tier: AgencyTier): {
  discounts?: Stripe.Checkout.SessionCreateParams.Discount[];
  allow_promotion_codes?: boolean;
} {
  if (tier === 'founder') {
    const { founderCouponIds } = agencyStripeConfig();
    if (founderCouponIds.length) {
      // Stripe: `discounts` and `allow_promotion_codes` are mutually exclusive.
      return { discounts: founderCouponIds.map((coupon) => ({ coupon })) };
    }
  }
  return { allow_promotion_codes: true };
}

/**
 * Reconcile a single user's agency subscription per-site quantity with their
 * current billable-site count. Best-effort and idempotent: a no-op when the
 * quantity already matches or the user has no active agency subscription.
 * Returns the outcome for logging.
 */
export async function syncAgencySiteQuantity(
  userId: string,
  client?: AnyClient
): Promise<{ synced: boolean; from?: number; to?: number; reason?: string }> {
  const supa = (client ?? (await getServerSupabase({ serviceRole: true }))) as AnyClient;
  const { perSitePriceId } = agencyStripeConfig();
  if (!perSitePriceId) return { synced: false, reason: 'persite_price_unconfigured' };

  // Find the user's subscription id via their merchants -> merchant_billing.
  const { data: merchants } = await (supa as any)
    .from('merchants')
    .select('id')
    .eq('owner_id', userId);
  const ids = (merchants || []).map((m: any) => m.id);
  if (!ids.length) return { synced: false, reason: 'no_merchant' };

  const { data: mb } = await (supa as any)
    .from('merchant_billing')
    .select('stripe_subscription_id')
    .in('merchant_id', ids);
  const subId = (mb || [])
    .map((r: any) => r.stripe_subscription_id)
    .find((x: any) => !!x) as string | undefined;
  if (!subId) return { synced: false, reason: 'no_subscription' };

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch {
    return { synced: false, reason: 'subscription_missing' };
  }
  if (sub.status === 'canceled') return { synced: false, reason: 'subscription_canceled' };

  const item = sub.items.data.find((i) => i.price?.id === perSitePriceId);
  if (!item) return { synced: false, reason: 'no_persite_item' };

  const desired = await countBillableSites(supa, userId);
  const current = item.quantity ?? 0;
  if (desired === current) return { synced: false, from: current, to: desired, reason: 'in_sync' };

  await stripe.subscriptionItems.update(item.id, {
    quantity: desired,
    proration_behavior: 'create_prorations',
  });
  return { synced: true, from: current, to: desired };
}
