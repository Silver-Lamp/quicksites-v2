// lib/evolve/features.ts
//
// The Evolve page's matrix: the restaurant's site today vs. the same site with ordering. Every
// "evolved" cell names a feature that EXISTS in this repo (file beside each), so the matrix can
// never promise something the product does not do. The "today" column is what we observed or
// an honest "—"; it never asserts a weakness we did not see.

export type EvolveFeatureRow = {
  key: string;
  label: string;
  /** What we can say about their site today. `null` → rendered as "—" (not observed). */
  today: string | null;
  evolved: string;
  /** Where the evolved claim is true in code — for the reviewer, not the page. */
  because: string;
};

export function evolveFeatureRows(input: { orderingToday: string | null; providerLabel: string | null; keepsSite: true }): EvolveFeatureRow[] {
  return [
    {
      key: 'ordering',
      label: 'Online ordering',
      today: input.orderingToday,
      evolved: 'Yes — pickup and call-ahead orders from a phone, from your own menu',
      because: 'menu block + order_bar + authorizeCheckoutItems (docs/RESTAURANT_VERTICAL.md)',
    },
    {
      key: 'alerts',
      label: 'When an order comes in',
      today: null,
      evolved: 'A text and an email to the number and address you choose, the moment it is paid',
      because: 'lib/commerce/orderNotify.ts (order_notify_sms + email on markOrderPaid)',
    },
    {
      key: 'portal',
      label: 'Managing orders',
      today: null,
      evolved: 'Your own orders page: every order, its items and status, on your phone or a laptop',
      because: 'app/merchant/orders',
    },
    {
      key: 'menu',
      label: 'Your menu',
      today: 'On your site, as a page to read',
      evolved: 'Read from your site, prices confirmed by you before anything goes live, editable any time',
      because: 'buildDraftFromSite + menuEvidence; owner confirms prices in the editor',
    },
    {
      key: 'site',
      label: 'Your current website',
      today: input.providerLabel ? `Served by ${input.providerLabel}` : 'Stays as it is',
      evolved: 'Stays exactly as it is — the ordering page links from it',
      because: 'meta.ordering_companion; nothing is migrated',
    },
    {
      key: 'cost',
      label: 'What you pay for ordering',
      today: 'Nothing today — and no orders',
      evolved: 'No monthly fee and no contract; a small share of each online order, card processing included',
      because: 'lib/commerce/pricingDefaults.ts (restaurant fee, floor, no monthly); on_behalf_of off',
    },
    {
      key: 'payout',
      label: 'Getting paid',
      today: null,
      evolved: 'Card payments go to your own Stripe account; you connect it once',
      because: 'Stripe Connect destination charges (lib/payments/stripe.ts)',
    },
    {
      key: 'customers',
      label: 'Your customers',
      today: null,
      evolved: 'Every buyer saved to a customer list you own, with their order history',
      because: 'customers identity spine (lib/commerce/customers.ts, /merchant/customers)',
    },
  ];
}
