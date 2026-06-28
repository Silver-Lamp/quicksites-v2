// lib/billing/plans.ts
//
// Central source of truth for QuickSites subscription plans (Path B — Agency)
// and the plan-resolution helpers shared by billing, membership and the
// commerce take-rate (Path A). See docs/PRICING_REDESIGN.md.
//
// Model:
//   - Agency plan = per-user platform price + per-site price (quantity = #sites).
//   - One published price set (Public: $19 platform + $6/site). Founders get a
//     repeating coupon (12-mo) that auto-expires back to Public pricing.
//   - Agency-plan merchants are EXEMPT from the per-order platform fee (they pay
//     flat instead) — see isAgencyPlanMerchant + lib/commerce/orders.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export type AgencyTier = 'founder' | 'public';

/** Canonical plan labels persisted to user_plans.plan / merchant_billing.plan. */
export const PLAN_AGENCY = 'agency';
export const PLAN_AGENCY_FOUNDER = 'agency_founder';
export const PLAN_FREE = 'free';

/** Subscription statuses we treat as "currently on the plan" for entitlements/exemption. */
export const ACTIVE_PLAN_STATUSES = new Set(['active', 'trialing', 'past_due']);

/** True for any agency tier (founder or public). */
export function isAgencyPlan(plan?: string | null): boolean {
  return !!plan && plan.toLowerCase().startsWith('agency');
}

/** True for any paid (non-free) plan label. */
export function isPaidPlan(plan?: string | null): boolean {
  if (!plan) return false;
  const p = plan.toLowerCase();
  return p !== PLAN_FREE && p !== 'none' && p !== '';
}

/** Map a Stripe checkout tier to the canonical plan label we persist. */
export function planForTier(tier: AgencyTier): string {
  return tier === 'founder' ? PLAN_AGENCY_FOUNDER : PLAN_AGENCY;
}

/** Stripe price/coupon config for the agency plan (env-driven). */
export function agencyStripeConfig() {
  const platformPriceId = process.env.STRIPE_PRICE_AGENCY_PLATFORM || '';
  const perSitePriceId = process.env.STRIPE_PRICE_AGENCY_PERSITE || '';
  // One or more Stripe coupon IDs applied for Founder checkout (comma-separated).
  // Recommended: two product-restricted percent_off coupons (platform 21.05%,
  // per-site 16.67%) with duration=repeating, duration_in_months=12, so $19/$6
  // bills as $15/$5 for the first year, then auto-rolls to Public pricing.
  const founderCouponIds = (process.env.STRIPE_COUPON_AGENCY_FOUNDER || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { platformPriceId, perSitePriceId, founderCouponIds };
}

type AnyClient = SupabaseClient<any, any, any>;

/**
 * Count a user's billable sites for per-site quantity. A billable site is a
 * published, non-archived site template owned by the user. Drafts are free.
 */
export async function countBillableSites(
  supa: AnyClient,
  userId: string
): Promise<number> {
  const { count, error } = await (supa as any)
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('is_site', true)
    .eq('archived', false)
    .eq('published', true);
  if (error) throw error;
  return count ?? 0;
}

export type ResolvedPlan = {
  plan: string;
  status: string;
  source: 'user_plans' | 'merchant_billing' | 'none';
};

/**
 * Resolve a user's current plan label + status from our DB (no Stripe call).
 * user_plans is authoritative; merchant_billing is the fallback. Returns a free
 * plan when nothing is found.
 */
export async function getUserPlan(
  userId: string,
  client?: AnyClient
): Promise<ResolvedPlan> {
  const supa = (client ?? (await getServerSupabase({ serviceRole: true }))) as AnyClient;

  // 1) user_plans (authoritative)
  try {
    const { data } = await (supa as any)
      .from('user_plans')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.plan) {
      return { plan: data.plan, status: data.status ?? 'active', source: 'user_plans' };
    }
  } catch {
    /* ignore */
  }

  // 2) merchant_billing via the user's merchants
  try {
    const { data: merchants } = await (supa as any)
      .from('merchants')
      .select('id')
      .eq('owner_id', userId);
    const ids = (merchants || []).map((m: any) => m.id);
    if (ids.length) {
      const { data: mb } = await (supa as any)
        .from('merchant_billing')
        .select('plan, stripe_subscription_id')
        .in('merchant_id', ids);
      const row = (mb || []).find((r: any) => r.plan) || (mb || [])[0];
      if (row?.plan) {
        const status = row.stripe_subscription_id ? 'active' : 'none';
        return { plan: row.plan, status, source: 'merchant_billing' };
      }
    }
  } catch {
    /* ignore */
  }

  return { plan: PLAN_FREE, status: 'none', source: 'none' };
}

/**
 * Is this merchant owned by a user on an active agency plan? Agency-plan
 * merchants pay a flat subscription, so their orders are exempt from the
 * per-order platform fee. Best-effort: returns false on any lookup failure so a
 * fee is never silently dropped by an unrelated error.
 */
export async function isAgencyPlanMerchant(
  merchantId: string,
  client?: AnyClient
): Promise<boolean> {
  try {
    const supa = (client ?? (await getServerSupabase({ serviceRole: true }))) as AnyClient;
    const { data: merchant } = await (supa as any)
      .from('merchants')
      .select('owner_id')
      .eq('id', merchantId)
      .maybeSingle();
    if (!merchant?.owner_id) return false;
    const { plan, status } = await getUserPlan(merchant.owner_id, supa);
    return isAgencyPlan(plan) && ACTIVE_PLAN_STATUSES.has(status);
  } catch {
    return false;
  }
}
