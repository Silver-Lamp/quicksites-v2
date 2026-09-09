// lib/commerce/pricingPolicy.ts
//
// Where the platform take-rate defaults live. Two markets today:
//
//  • Restaurant / menu-ordering merchants (the delivered.menu demand-capture funnel):
//    a single-digit take that beats DoorDash + a small PER-ORDER floor so a small ticket
//    still clears Stripe's fixed $0.30. **No monthly** — the cold no-website segment
//    won't sign a recurring fee, and "keep the rest, we only earn when you sell" is the
//    sharpest pitch. A subscription buy-down (lower % for a monthly) comes later, once
//    real order volume tells us where merchants land. See docs/RESTAURANT_VERTICAL.md §7c.
//
//  • General commerce: the pre-existing 5% / no-floor default (unchanged).
//
// A merchant's default is chosen by whether their site is a menu-ordering site (has a
// `menu` block), so no other vertical is touched. All numbers env-overridable + clamped
// to the partner cap. Merchants can still be tuned individually afterwards.
import { supabaseAdmin } from '@/lib/supabase/admin';
// ⚠️ The NUMBERS live in pricingDefaults.ts (pure) and are re-exported here. This module also
// imports the service-role client for its DB helpers, so a client component must never import
// it: /pricing did, and hydrated into "Application error: supabaseKey is required".
import {
  RESTAURANT_FEE_PERCENT,
  RESTAURANT_FEE_MIN_CENTS,
  GENERAL_FEE_PERCENT,
  GENERAL_FEE_MIN_CENTS,
  restaurantFeeDefault,
  generalFeeDefault,
  type FeeDefault,
} from '@/lib/commerce/pricingDefaults';

export {
  RESTAURANT_FEE_PERCENT,
  RESTAURANT_FEE_MIN_CENTS,
  GENERAL_FEE_PERCENT,
  GENERAL_FEE_MIN_CENTS,
  restaurantFeeDefault,
  generalFeeDefault,
  type FeeDefault,
} from '@/lib/commerce/pricingDefaults';

/** A `menu` block is the restaurant vertical's ordering surface — the definitive marker
 *  of a menu-ordering site, robust to how the merchant was acquired or its industry label. */
export function hasMenuBlock(data: any): boolean {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  return pages.some(
    (p: any) => Array.isArray(p?.blocks) && p.blocks.some((b: any) => b?.type === 'menu')
  );
}

/**
 * The take-rate a merchant's payment account should launch on. Menu-ordering site →
 * restaurant terms; everything else → general. Falls back to general on any lookup error.
 */
export async function resolveMerchantFeeDefault(merchantId: string): Promise<FeeDefault> {
  try {
    const { data: m } = await supabaseAdmin
      .from('merchants')
      .select('site_slug')
      .eq('id', merchantId)
      .maybeSingle();
    const slug = (m as { site_slug?: string | null } | null)?.site_slug;
    if (!slug) return generalFeeDefault();
    const { data: t } = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('slug', slug)
      .maybeSingle();
    if (hasMenuBlock((t as { data?: any } | null)?.data)) return restaurantFeeDefault();
  } catch {
    /* fall through to general */
  }
  return generalFeeDefault();
}
