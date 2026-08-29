// lib/business/verticals.ts
//
// The business plan, as data rather than a slide deck: one entry per monetization line,
// each carrying its thesis, its unit economics, what is BUILT, what is UNPROVEN, and the
// specific observation that would settle the question.
//
// ⚠️ The `evidence` numbers are read from the live database at render time, never typed in.
// A plan shown to a partner or an investor that quotes a number nobody re-derives is the
// failure mode this whole repo is organised against — and it is worse here than anywhere
// else, because the reader cannot check it and will act on it.
//
// The honest position today is that the rails are built and proven with live money, and
// demand is almost entirely untested. Saying so is not modesty; it is the only version of
// this document that survives someone doing diligence.
//
// ⚠️ THIS MODULE MUST NOT TOUCH THE DATABASE. The deck is a client component and imports
// STAGE_LABEL from here as a *value*, so anything this file imports is bundled into the
// browser. It used to import `supabaseAdmin`, which instantiates a Supabase client at module
// load — in the browser the service-role key is undefined (Next only inlines NEXT_PUBLIC_*),
// so the deck died on load with "supabaseKey is required" and rendered nothing. The loader
// lives in ./planEvidence instead. No key ever reached the bundle — verified by grepping the
// deployed chunk — but the page was broken from the day it shipped.

export type VerticalKey = 'rental' | 'commerce' | 'agency' | 'restaurant' | 'pod' | 'partners';

export type Stage = 'proven' | 'live-untested' | 'built-inert' | 'planned';

export const STAGE_LABEL: Record<Stage, string> = {
  proven: 'Proven with real money',
  'live-untested': 'Live — demand untested',
  'built-inert': 'Built, not switched on',
  planned: 'Planned',
};

export type Vertical = {
  key: VerticalKey;
  name: string;
  /** One line, the way you would say it out loud. */
  oneLiner: string;
  stage: Stage;
  /** Where the money comes from, mechanically. */
  mechanics: string[];
  /** What exists and works today. */
  built: string[];
  /** What is genuinely not known. Written to be uncomfortable, not reassuring. */
  unproven: string[];
  /** The single observation that would move this from opinion to fact. */
  decisiveTest: string;
  /** What it would cost to run that test. */
  costToTest: string;
};

export const VERTICALS: Vertical[] = [
  {
    key: 'rental',
    name: 'SEO Site Rental',
    oneLiner:
      'Buy the exact domain people type when they need a trade in their town, put a working site on it, and rent it to one business in that town.',
    stage: 'live-untested',
    mechanics: [
      'We own the domain, so the asset never leaves. The renter leases exclusivity, not a website.',
      '$99/month locked for life before the domain ranks; $399/month for new customers once it reaches page one.',
      'Commission on every payment: 50% closer, 15% manager, 35% house — taken from net of card fees.',
      'Exclusivity is the product. One business per city and trade, which is also why the price holds.',
    ],
    built: [
      'Stripe subscription checkout, webhook write-back, and commission accrual to the ledger the payout runner already pays from.',
      'Automated domain discovery, site generation, publishing, and GSC rank sync that steps the price up on page one.',
      'A sales split model and per-rental payout report at /admin/splits.',
    ],
    unproven: [
      'Nobody outside the company has ever rented one. The only live subscription is the owner’s own card.',
      'Churn is completely unmeasured — no customer has renewed, so none has cancelled. It decides lifetime value more than close rate does.',
      'Not one of 99 domains has reached page one, so the $399 tier currently has zero qualifying inventory.',
      'The founder rate is locked for life, so every early sale caps its own upside permanently.',
    ],
    decisiveTest:
      'Ten businesses pitched by phone, and the count that say yes. One trial from four calls is not a close rate — it is one afternoon and one person’s manner.',
    costToTest: 'Roughly two weeks of one salesperson. No new spend; the inventory already exists.',
  },
  {
    key: 'commerce',
    name: 'Open Commerce',
    oneLiner: 'Merchants sell through sites we host, and the platform takes a fee on every order.',
    stage: 'live-untested',
    mechanics: [
      'Per-order platform fee, collected through Stripe Connect as an application fee at the moment of payment.',
      'Fee is charged on the pre-tax subtotal and reversed on refund.',
      'Agency-plan merchants are exempt — they pay a flat subscription instead, so the two lines never double-charge.',
    ],
    built: [
      'End-to-end money path: cart, checkout, Connect payouts, refunds with fee reversal, reconciliation.',
      'A buyer CRM with segments and consent-gated campaigns, free to every merchant.',
      'Green-path proofs that assert the arithmetic without touching real Stripe.',
    ],
    unproven: [
      'Total lifetime commerce revenue is under ten dollars, across three orders, two of them ours.',
      'No merchant has yet run meaningful volume through it, so the fee rate has never been tested against what a real merchant will tolerate.',
      'Only two merchants have completed Stripe onboarding.',
    ],
    decisiveTest:
      'One merchant doing genuine weekly volume for a month — enough orders that the take-rate becomes a number they notice and either accept or negotiate.',
    costToTest: 'Nothing to build. It needs a merchant who already has customers.',
  },
  {
    key: 'agency',
    name: 'Agency & White-label',
    oneLiner:
      'Resellers rebrand the builder and commerce layer and sell it to their own client base; we charge per user and per site.',
    stage: 'built-inert',
    mechanics: [
      'Per-user platform price plus a per-site price, billed as one Stripe subscription with the site count as quantity.',
      'Founder pricing runs as a repeating coupon that auto-expires back to public pricing, so nobody is grandfathered by accident.',
      'Reseller orgs get their own branding on login, admin chrome, transactional email and theme accents.',
    ],
    built: [
      'Plans, entitlements, per-site quantity sync, and a billing portal.',
      'White-label branding resolved host-to-org, including per-org email senders.',
    ],
    unproven: [
      'No reseller has ever been signed. The pricing has never been said out loud to a buyer.',
      'The per-site quantity model assumes resellers grow site counts steadily; nothing tests that.',
      'Branded email is inert until a sending domain is verified.',
    ],
    decisiveTest:
      'One agency running five client sites on it for a full billing cycle, and whether the per-site price survives their first invoice.',
    costToTest: 'A verified sending domain, and one agency willing to move real clients.',
  },
  {
    key: 'restaurant',
    name: 'Restaurant Ordering',
    oneLiner:
      'Restaurants with no website get an ordering site built from their own listing, reachable at delivered.menu, and we take a fee on orders.',
    stage: 'built-inert',
    mechanics: [
      'Same per-order take-rate as Open Commerce, on a vertical where the alternative is a delivery app charging many times more.',
      'The same URL spans the lifecycle: an unclaimed draft is watermarked and noindexed; claiming it makes it live and indexable.',
      'Demand is measured before signup by logging order intent — never money, never a held order.',
    ],
    built: [
      'Listing import, menu OCR from photos, structured menu extraction, and a claim flow with phone verification.',
      'A menu-forward site with cart and checkout wired to the same server-authoritative money path.',
    ],
    unproven: [
      'Nineteen restaurants were texted a free site and not one replied — including "no thanks".',
      'Roughly half of built drafts carry a menu inferred from photos, which is inventory that cannot be sent without a human checking it.',
      'No restaurant has taken an order through it.',
    ],
    decisiveTest:
      'A single restaurant taking real orders for two weeks, and whether the staff keep using it once the novelty passes.',
    costToTest: 'One restaurant, hand-held. The drafts already exist.',
  },
  {
    key: 'pod',
    name: 'Print on Demand',
    oneLiner:
      'Authors and creators sell books, posters and apparel from their own site; printing is outsourced and the fee is taken on margin.',
    stage: 'built-inert',
    mechanics: [
      'The platform fee is charged on margin with the printer’s base cost carved out, so a fee is never taken on cost of goods.',
      'Fulfilment fires automatically on payment; print jobs sync back by cron and webhook.',
    ],
    built: [
      'Lulu and Gelato integrations, catalog authoring, an admin view of print orders, and a green-path proof that asserts the margin arithmetic.',
      '"Author" is a first-class industry in the site builder.',
    ],
    unproven: [
      'Zero print orders have ever been placed. The integration is proven against the providers, not against demand.',
      'It is gated off in production and has never run for a real author.',
    ],
    decisiveTest:
      'One author with an existing audience selling one print run, and whether the margin after printing is worth anyone’s time.',
    costToTest: 'Switching the flag on, and one author who already has readers.',
  },
  {
    key: 'partners',
    name: 'Partner & Referral Network',
    oneLiner:
      'Partners bring merchants and earn a lifetime residual; whoever recruited the partner earns an override on top.',
    stage: 'built-inert',
    mechanics: [
      'A reseller keeps a majority share of the platform fee for the life of the account.',
      'A recruiting "hub" earns a configurable override funded out of the platform’s own share — clamped in code so it can never reach into the reseller’s cut.',
      'Vanity codes can be minted before the person has an account; the balance accrues as held until they claim it.',
    ],
    built: [
      'Attribution from first touch, commission ledger, payout runs, clawbacks on refund, and a partner earnings dashboard.',
      'The same ledger now carries rental commissions, so one payout mechanism serves every line.',
    ],
    unproven: [
      'No commission has ever been paid to anyone. The ledger is empty.',
      'The residual rate has never been negotiated with a real partner, so it is a guess about what motivates people.',
    ],
    decisiveTest:
      'One partner earning a residual large enough that they change their behaviour to protect it.',
    costToTest: 'Nothing to build. It needs a partner with a network.',
  },
];

export function getVertical(key: string | undefined): Vertical {
  return VERTICALS.find((v) => v.key === key) ?? VERTICALS[0];
}
