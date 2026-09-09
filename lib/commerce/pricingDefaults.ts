// lib/commerce/pricingDefaults.ts
//
// The take-rate NUMBERS, and nothing else — importable from a client component.
//
// ⚠️ /pricing is a client component and imported these constants from pricingPolicy.ts, which also
// imports the service-role Supabase client for its DB helpers. In the browser bundle that client
// is constructed with an undefined key and throws "supabaseKey is required" at module load, so the
// whole page hydrated into "Application error" while the server-rendered HTML looked fine (a check
// that curls the page passes; only a browser sees it). Pure module here; pricingPolicy re-exports
// it for server callers. Pinned by lib/commerce/__tests__/pricingDefaultsClientSafe.test.ts.
//
// Two markets (see pricingPolicy.ts for the why): restaurant / menu-ordering merchants get a
// single-digit take + a small per-order floor and no monthly; general commerce keeps 5% / no floor.
// All env-overridable and clamped to the partner cap.
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
