// lib/analytics/events.ts
//
// Canonical analytics event names. Import these instead of typing string literals
// so the PostHog funnels stay consistent across client + server captures.
//
// The Model A money funnel (see docs/MODEL_A_PLAN.md) is, in order:
//   signup → builder_activated → site_published → merchant_connected
//          → catalog_item_created → order_created → order_paid → platform_fee_collected
export const EVENTS = {
  // Acquisition / activation
  SIGNUP: 'signup',
  BUILDER_ACTIVATED: 'builder_activated', // first meaningful template edit/save
  SITE_PUBLISHED: 'site_published',

  // Merchant onboarding (Model A money path)
  MERCHANT_CONNECTED: 'merchant_connected', // Stripe Connect onboarding complete (payment_accounts active)
  CATALOG_ITEM_CREATED: 'catalog_item_created',

  // Orders / revenue
  ORDER_CREATED: 'order_created',
  ORDER_PAID: 'order_paid',
  PLATFORM_FEE_COLLECTED: 'platform_fee_collected', // the dollar we keep
  ORDER_REFUNDED: 'order_refunded',
  PLATFORM_FEE_REVERSED: 'platform_fee_reversed',

  // Partner / affiliate (Model B — same ledger, instrument now so it's ready)
  COMMISSION_ACCRUED: 'commission_accrued',
  COMMISSION_PAID: 'commission_paid',

  // AI cost
  LLM_CALL: 'llm_call',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
