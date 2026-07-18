// lib/payments/onBehalfOf.ts
//
// Flag: set Stripe `on_behalf_of` to the connected account on Connect charges.
//
// Today (flag OFF) checkout uses plain destination charges, so QuickSites is the settlement
// merchant of record and PAYS Stripe processing out of the platform fee (~3.2% of GMV) — which
// makes QS's net thin and is the root of the reseller-80%-underwater problem (see
// docs/REFERRAL_PRICING.md). Setting `on_behalf_of` makes the MERCHANT the settlement merchant
// of record, moving Stripe's fee incidence + statement descriptor + dispute liability to their
// side, so QS keeps the full application fee.
//
// This is a merchant-of-record change with real external implications (descriptor, disputes,
// tax reporting) and its exact fee flow depends on Connect config — so it ships OFF by default.
// Flip QS_STRIPE_ON_BEHALF_OF=1 in a TEST-MODE Connect account first, run a charge, and verify
// the balance-transaction fee lands on the connected account before enabling in prod.

export function stripeOnBehalfOfEnabled(): boolean {
  return (
    process.env.QS_STRIPE_ON_BEHALF_OF === '1' || process.env.QS_STRIPE_ON_BEHALF_OF === 'true'
  );
}
