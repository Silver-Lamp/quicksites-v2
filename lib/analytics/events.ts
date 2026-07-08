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
  REBUILD_STARTED: 'rebuild_started', // /rebuild: a URL was submitted for AI rebuild
  REBUILD_COMPLETED: 'rebuild_completed', // /rebuild: a draft was generated from that URL
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

  // Customer CRM (buyer-level — distinctId is the customer_id, not the merchant)
  CUSTOMER_CREATED: 'customer_created', // first paid order builds a new customer
  REPEAT_PURCHASE: 'repeat_purchase', // an existing customer orders again (orders_count ≥ 2)
  CUSTOMER_UNSUBSCRIBED: 'customer_unsubscribed', // one-click marketing opt-out

  // Marketing campaigns
  CAMPAIGN_SENT: 'campaign_sent', // an email blast went out to a segment
  CAMPAIGN_ORDER_ATTRIBUTED: 'campaign_order_attributed', // a paid order credited to a recent campaign (last-touch)

  // Partner / affiliate (Model B — same ledger, instrument now so it's ready)
  COMMISSION_ACCRUED: 'commission_accrued',
  COMMISSION_PAID: 'commission_paid',

  // AI cost
  LLM_CALL: 'llm_call',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
