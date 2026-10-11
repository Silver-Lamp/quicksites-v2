// lib/sales/forSalesPitches.ts
//
// The two sentences /for-sales opens with (owner, 2026-10-11: "simplify even further, add more
// details under collapse arrows"). Each heads a native <details>; the sections that explain it
// are the fold. The order is the owner's. Kept out of the page file so tests can import them
// and so Next's page-export check is not tripped by a stray constant.
export const FOR_SALES_PITCHES = {
  business: 'Know a small business owner? Help them Evolve their online presence, and earn for life (takes just 1 minute).',
  lunch: 'Know of a great lunch spot? Help them take orders online. Takes 1 minute, and earn for life.',
} as const;

/**
 * Inside the business pitch: one box per vertical, opened one at a time (owner, 2026-10-11:
 * "show additional boxes for them to choose from … the owner wanting an e-commerce website,
 * and have the SEO site sales one be secondary"). Order is the owner's: store first, free site
 * second, the domain rental last.
 */
export const BUSINESS_SUBPITCHES = {
  store: {
    title: 'They sell things, but not online yet.',
    line: 'A store with checkout, built from what they already sell. When orders run through it, your share of each order is paid the same way as the restaurants.',
  },
  website: {
    title: 'They have no website at all.',
    line: 'A free site built from their public listing, claimed with one link that carries your code. Self-serve from there — the door, not the paycheck.',
  },
  rental: {
    title: 'A tradesperson who wants the city\'s exact-match domain.',
    line: 'The domain rental — our older product, a phone call rather than a minute, half the rent to you for as long as they stay. Worth it when it fits; not where to start.',
  },
} as const;
