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

export type VerticalKey =
  | 'rental' | 'commerce' | 'agency' | 'restaurant' | 'pod' | 'partners' | 'trade_sites';

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
      'Two tiers, split by what can be proved on the call: a domain holding page one today is sold in the present tense — the prospect searches the phrase while the rep waits — and everything else is sold plainly as new, at the founder rate. No version of the pitch predicts a ranking.',
      'Commission on every payment: 50% closer, 15% manager, 35% house — taken from net of card fees.',
      'Exclusivity is the product. One business per city and trade, which is also why the price holds.',
      'Ceiling of the provable inventory, measured 2026-09-06: if every domain that currently holds page one were rented at the page-one rate, the six of them bill $2,094/month — $25,128/year — of which roughly $711/month reaches the house after card fees and both commissions. Zero are rented. That is a capacity figure and it is the one most likely to be misread as revenue; the live version is at /for-sales/rate-card.',
    ],
    built: [
      'Stripe subscription checkout, webhook write-back, and commission accrual to the ledger the payout runner already pays from.',
      'Automated domain discovery, site generation, publishing, and GSC rank sync that steps the price up on page one.',
      'A sales split model and per-rental payout report at /admin/splits.',
    ],
    unproven: [
      'Nobody outside the company has ever rented one. The only live subscription is the owner’s own card.',
      'Churn is completely unmeasured — no customer has renewed, so none has cancelled. It decides lifetime value more than close rate does.',
      'None of the 99 campaign domains has reached page one. Six other domains we own do hold it — and not one of those six is a campaign, so the only proof we own is the one thing no rep can currently sell. Making them rentable is about a day of data work.',
      'What ranks is each domain’s own exact-match name — “grafton towing” — which is real commercial intent but a small pool. They do not rank for the broad trade search: the handful of generic page-one queries carry one or two appearances a month and no clicks at all. Positions move, so every figure here is dated where it appears.',
      'Traffic is the weakest part of the case and the easiest to overstate. Measured 2026-09-06 over the preceding 28 days: three page-one clicks across the entire portfolio, and the qualifying positions worth roughly $116/month of equivalent ad spend across all six domains. Those two numbers are a dated observation, not a standing fact — re-read them at /proof/rankings before quoting them. The product is an exclusive address and a working site, not traffic.',
      'The map results, where most local search clicks go, require a Google Business Profile — which belongs to a real business at a real address, and we will not create those. That channel is only reachable through a renter who already has one, which caps what any unrented domain can do.',
      'The founder rate is locked for life, so every early sale caps its own upside permanently.',
    ],
    decisiveTest:
      'Postcards to the no-website businesses in one city where the domain provably holds page one, and the count that call back. The card tells them to search a phrase and see for themselves, so it tests the offer rather than a salesperson’s manner — which the phone attempt could not separate. Current record: zero replies from 24 touches, so the honest prior is low.',
    costToTest: 'Roughly two weeks of one salesperson. No new spend; the inventory already exists.',
  },
  {
    key: 'trade_sites',
    name: 'Auto-built Trade Sites',
    oneLiner:
      'Build a working website for a local trade business from its public listing — for the ones that have none — and sell it to them for the price of a phone plan.',
    stage: 'built-inert',
    mechanics: [
      'Their own name and their own site, not one of our geo domains. Nothing is exclusive and nothing is scarce, so this is a subscription rather than a rental.',
      'Free until claimed: an unclaimed draft renders watermarked and noindex behind a "claim this site" bar. The claim is the conversion event, not the site.',
      'Three tiers once claimed — the site on a QuickSites subdomain, the same site on a custom domain we register and manage, and a managed tier where we keep it current.',
      'Self-serve by necessity. A salesperson costs more to acquire a customer than this earns in a year, so it is a claim link and a card on file or it is nothing. Reps sell the geo rental instead.',
    ],
    built: [
      'The whole production line already exists for restaurants: listing import, draft assembly, watermark-and-noindex until claimed, tokenised claim links, ownership transfer on claim.',
      'Marginal cost is cents — 1,379 metered AI calls cost $25 across a month, and a subdomain costs nothing.',
      'Generated copy no longer invents hours, response times, licensing, guarantees or prices about a business we have never spoken to (#903).',
    ],
    unproven: [
      'Nobody has ever paid for one. A self-serve checkout for the custom-domain tier now exists on the post-claim page (flag-gated), so the price is a thing someone can be asked for — it is still a proposal until someone says yes.',
      'The restaurant model funds itself with a take-rate on orders. A towing company has no transaction to tax, so the free-site-plus-commission logic does not carry over and this has to be sold.',
      'The claim rate is completely unknown. Everything downstream is a fraction of a number nobody has measured, and the only cold-outreach evidence we own is 0 replies from 24 touches.',
      'A subdomain has no SEO story: our own page-one geo domains are worth roughly $116/month of equivalent traffic between them, and this is worth less. It sells on existing, being findable by name, and not looking defunct.',
      'Volume is the whole model and there is not much of it yet — 60 no-website towing prospects, 30 restaurant, 14 concrete. At $19/month and a generous 10% claim-to-paid that is about $114/month.',
    ],
    decisiveTest:
      'Send the claim link to every no-website business in one trade and count two numbers: how many claim a free site, and how many of those pay for a domain. The first tests whether the site is wanted; the second tests whether it is worth money. They are different questions and the first is cheap.',
    costToTest:
      'Production is already paid for. The real spend is the outreach and building a checkout for the tier — call it a week, plus postage.',
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
