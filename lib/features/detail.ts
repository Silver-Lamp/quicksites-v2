// lib/features/detail.ts
//
// The depth behind each /features card.
//
// ⚠️ WHY THIS FILE EXISTS AND NOT A DB COLUMN. The `features` table has 16 rows, every one with
// a slug, and NONE with tags, images, gallery, site_url or a second paragraph — `blurb`
// averages 119 characters. So the cards looked clickable and 14 of 16 had nowhere to go: a
// hover-lift and a cursor promising a destination that did not exist. The fix is to make the
// destination real, not to remove the affordance.
//
// ⚠️ AND EVERY CLAIM HERE IS ABOUT SOMETHING THAT SHIPPED. A features page is the easiest place
// in a product to write a sentence nobody has earned. Each entry below describes mechanics that
// exist in this repo; where a thing is gated, partial, or dependent on the operator finishing a
// setup step, `caveat` says so ON THE PAGE rather than in a footnote nobody reads. If you add a
// feature here before it works, you have written the marketing equivalent of a fabricated
// testimonial — see crosstalk/contracts/honest-scaffold-standard.md.

export type FeatureDetail = {
  /** One paragraph: what it actually does for the person reading. */
  what: string;
  /** Concrete mechanics — the things that make the claim checkable. */
  how: string[];
  /** Stated plainly on the page when a feature is gated, partial, or needs setup. */
  caveat?: string;
};

export const FEATURE_DETAIL: Record<string, FeatureDetail> = {
  'ecommerce-storefront': {
    what: 'Your site sells. Catalog items, a cart, and Stripe Checkout ride on the same template you already edit — there is no second system to learn and no separate store to keep in sync.',
    how: [
      'Catalog items live alongside the site; a menu, products grid or service block adds to the same cart.',
      'Checkout is server-authoritative — the browser sends item ids, never prices, and the server re-prices every line including variants and add-ons.',
      'Payouts go straight to your own Stripe account via Connect; we never hold your money.',
    ],
    caveat: 'Taking live payments needs your own Stripe Connect onboarding — a few minutes, once.',
  },
  'seo-foundations-out-of-the-box': {
    what: 'The unglamorous things that decide whether anyone finds you, done on every site by default rather than sold back to you as an upgrade.',
    how: [
      'LocalBusiness structured data is built from your real name, address and hours and emitted on the published page.',
      'Per-page titles and descriptions, a sitemap, and a readiness score that names the specific gap rather than a grade.',
      'One-click fixes for the common misses — office address, schema, a service-in-city page.',
    ],
  },
  'ai-assist-pack-optional-': {
    what: 'Drafting help for the blank page: hero copy, service descriptions, FAQs and a hero image, so the first version of a site exists in minutes instead of evenings.',
    how: [
      'Every call is metered and cost-logged, with a hard spend guard — an AI feature cannot quietly run up a bill.',
      'Generated copy is a starting point in your editor, never published behind your back.',
      'Generated images never include people, by rule.',
    ],
    caveat: 'Optional and generated text is a draft. Anything presented as a customer’s words — reviews, testimonials — is never generated for you.',
  },
  'platform-fees-payouts': {
    what: 'A per-order fee instead of a monthly bill. We earn when you sell, which means hosting a site that makes you nothing costs you nothing.',
    how: [
      'The fee is computed at order time in integer cents and taken as a Stripe application fee — visible on every order, not reconciled later.',
      'Refunds reverse the platform fee automatically.',
      'Sales tax, when enabled, is excluded from the fee basis.',
    ],
  },
  'white-label-reseller': {
    what: 'Run the whole builder under your own name. Your clients see your brand across the surfaces that matter, not ours.',
    how: [
      'Per-organisation name, logo, dark logo and accent colour resolved from the host.',
      'Branded login, admin chrome and transactional email sender.',
      'Your clients never land on a QuickSites-branded page.',
    ],
    caveat: 'Branded email sending waits on a verified sending domain for your org.',
  },
  'in-your-voice': {
    what: 'A spoken welcome on your site, in your own voice — the one thing on a small business page that cannot be copied by a competitor with a better template.',
    how: [
      'Your voice is used only through a consented clone you create and control.',
      'Every clip reports which voice actually spoke it, and we label it with what was reported — never with what would sound better.',
      'Narrated reviews use the house narrator by design: a customer’s words are never spoken in a cloned voice.',
    ],
  },
  'block-based-template-editor': {
    what: 'Pages are built from blocks you can reorder, not a text box pretending to be a website. What you arrange is what publishes.',
    how: [
      'Every block is schema-validated, so a page cannot be saved into a broken state.',
      'Autosave as you work; publishing takes an immutable snapshot, so editing a live site never changes it mid-sentence.',
      'Light and dark are a property of the site, not a separate theme to maintain.',
    ],
  },
  'multi-tenant-routing-subdomains': {
    what: 'Every site gets a real address immediately, and a custom domain when you are ready — without a migration.',
    how: [
      'A subdomain works the moment you publish.',
      'Custom domains are registered and attached programmatically, DNS included.',
      'The same site keeps its content and its links across the change.',
    ],
  },
  'customer-crm': {
    what: 'The customer list builds itself. Every paid order becomes a customer record without anyone typing anything.',
    how: [
      'Buyers are deduplicated by email per merchant and linked to their orders automatically.',
      'Lifetime value and a unified timeline of orders and campaign touches on every profile.',
      'Free for every merchant — not a plan upgrade.',
    ],
  },
  'email-campaigns': {
    what: 'Email the customers you already have, and find out whether it actually produced orders.',
    how: [
      'Send to a segment, consent-gated, with one-click unsubscribe on every message.',
      'Orders within seven days of a send are attributed back to it, so a campaign reports revenue rather than opens.',
    ],
  },
  'revenue-dashboard': {
    what: 'What you actually made, after fees and partner commissions — not gross volume dressed up as income.',
    how: [
      'Orders, platform fees and payouts in one view.',
      'Partner and hub commissions subtracted, so the net figure is the one you can spend.',
    ],
  },
  'hear-this-page': {
    what: 'A listen button on the page, for people who would rather hear it than read it — on a phone, driving, or because reading is hard.',
    how: [
      'Short spoken summary, generated once per version of the page and cached.',
      'Always labelled as a narrator so nobody mistakes it for a person who works there.',
      'Defers to your own voice player when one is on the page.',
    ],
  },
  'customer-segments': {
    what: 'Group the customer list the way you actually think about it, and keep notes that survive staff turnover.',
    how: [
      'Filter and sort by spend, recency and tags; save the groupings you use.',
      'Notes, tags and marketing consent editable per customer, owner-gated.',
    ],
  },
  'search-console-bulk-stats': {
    what: 'Search performance for every site you run, in one table, instead of opening Search Console once per property.',
    how: [
      'Per-site clicks, impressions and position pulled together.',
      'Feeds the worklist that decides which site is worth attention next.',
    ],
    caveat: 'Needs your Google Search Console account connected once.',
  },
  'secondset-show-the-work': {
    what: 'Service transparency for trades: show the customer what was actually done, so the invoice explains itself.',
    how: [
      'Captured evidence of the work attached to the job it belongs to.',
      'Built for the conversation that starts with “what did I pay for?”',
    ],
    caveat: 'Pilot — not enabled on production accounts yet. Listed here because it is being built in the open, not because you can switch it on today.',
  },
  'lead-capture-call-tracking': {
    what: 'Know which pages produce phone calls and enquiries, so you stop guessing which half of the marketing works.',
    how: [
      'Contact submissions routed to the address on the site itself, never a relay someone can point elsewhere.',
      'Tap-to-call recorded as intent, with no personal details collected to make the count.',
    ],
  },
};

/** Detail for a slug, or null when we have nothing honest to add beyond the blurb. */
export function featureDetail(slug: string | null | undefined): FeatureDetail | null {
  if (!slug) return null;
  return FEATURE_DETAIL[slug] ?? null;
}
