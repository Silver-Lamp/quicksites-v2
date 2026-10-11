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
