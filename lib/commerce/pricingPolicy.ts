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
import { clampPlatformFeePercent } from '@/lib/commerce/partner-terms';

export type FeeDefault = { collect: boolean; percent: number; minCents: number };

function envNum(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Restaurant / menu-ordering take-rate: 8% + 60¢ floor, no monthly. */
export const RESTAURANT_FEE_PERCENT = clampPlatformFeePercent(
  envNum(process.env.QS_RESTAURANT_PLATFORM_FEE_PERCENT, 0.08)
);
export const RESTAURANT_FEE_MIN_CENTS = Math.max(
  0,
  Math.round(envNum(process.env.QS_RESTAURANT_PLATFORM_FEE_MIN_CENTS, 60))
);

/** General commerce take-rate (unchanged): 5% / no floor. */
export const GENERAL_FEE_PERCENT = clampPlatformFeePercent(
  envNum(process.env.QS_DEFAULT_PLATFORM_FEE_PERCENT, 0.05)
);
export const GENERAL_FEE_MIN_CENTS = Math.max(
  0,
  Math.round(envNum(process.env.QS_DEFAULT_PLATFORM_FEE_MIN_CENTS, 0))
);

export function restaurantFeeDefault(): FeeDefault {
  return {
    collect: RESTAURANT_FEE_PERCENT > 0,
    percent: RESTAURANT_FEE_PERCENT,
    minCents: RESTAURANT_FEE_MIN_CENTS,
  };
}
export function generalFeeDefault(): FeeDefault {
  return {
    collect: GENERAL_FEE_PERCENT > 0,
    percent: GENERAL_FEE_PERCENT,
    minCents: GENERAL_FEE_MIN_CENTS,
  };
}

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
