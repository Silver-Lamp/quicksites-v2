// lib/billing/entitlements.ts
//
// Minimal feature gating (Phase 3 seed). There are no per-plan feature gates in
// the app yet; this is the single helper to start with. Today only two features
// are gated to paid plans: custom domains and removing the QuickSites badge.
// Everything else stays free. Expand this into a real entitlements matrix later.

import { getUserPlan, isPaidPlan, ACTIVE_PLAN_STATUSES } from '@/lib/billing/plans';

export type Feature = 'custom_domain' | 'remove_branding' | 'ai_seo_coaching';

/** Features available only to active paid plans. */
const PAID_ONLY: ReadonlySet<Feature> = new Set<Feature>(['custom_domain', 'remove_branding', 'ai_seo_coaching']);

/**
 * Does this user's current plan allow the given feature? Fails OPEN is never
 * desirable for paywalled features, so on any lookup error we deny paid-only
 * features (treat the user as free).
 */
export async function planAllows(userId: string, feature: Feature): Promise<boolean> {
  if (!PAID_ONLY.has(feature)) return true;
  try {
    const { plan, status } = await getUserPlan(userId);
    return isPaidPlan(plan) && ACTIVE_PLAN_STATUSES.has(status);
  } catch {
    return false;
  }
}
