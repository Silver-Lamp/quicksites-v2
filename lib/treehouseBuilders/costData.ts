// lib/treehouseBuilders/costData.ts
//
// Every dollar figure the planner is allowed to use, each one published by a real builder on
// their own site and quoted with the date it was read.
//
// ⚠️ THERE IS NO MARKET AVERAGE HERE AND THERE MUST NEVER BE ONE. Three builders is not a
// dataset; averaging them would manufacture a number none of them said and hand it to someone
// about to spend $30,000. What this file holds is THEIR published ranges, attributed. The planner
// positions a project against those ranges and names whose figures each bound came from.
//
// ⚠️ NOTHING HERE IS A QUOTE, and Tree Top Builders say why better than we could: exact pricing
// is not possible "without knowing the trees they'll be working with". The planner repeats that
// rather than papering over it.
//
// To add a figure: read it on the company's own page, quote it, date it. A figure from a
// third-party cost aggregator does not go in this file — those are modelled, not quoted, and we
// would be laundering an estimate into an attribution.

export type PriceAnchor = {
  /** Who published it. Rendered next to the number, always. */
  builder: string;
  url: string;
  read: string;
  /** Their exact words. */
  quote: string;
  lowUsd?: number;
  highUsd?: number;
};

const READ = '2026-09-22';

export const PRICE_ANCHORS: PriceAnchor[] = [
  {
    builder: 'Treehouse Experts',
    url: 'https://www.treehouseexperts.com/',
    read: READ,
    quote: 'Suspended platforms starting at $5,400; vacation-rental treehouses starting at $60,000.',
    lowUsd: 5_400,
    highUsd: 60_000,
  },
  {
    builder: 'Tree Top Builders',
    url: 'https://treetopbuilders.net/pages/tree-house-pricing',
    read: READ,
    quote: 'Tree houses cost between $9,000 and several hundred thousand dollars.',
    lowUsd: 9_000,
  },
  {
    builder: 'Tree Top Builders',
    url: 'https://treetopbuilders.net/pages/baltimore-maryland-treehouse',
    read: READ,
    quote: 'A Baltimore, Maryland treehouse would cost between $26,000 and $36,000.',
    lowUsd: 26_000,
    highUsd: 36_000,
  },
  {
    builder: 'Nelson Treehouse',
    url: 'https://nelsontreehouse.com/design-build/',
    read: READ,
    quote:
      'Our current baseline price of fully designing and building a custom treehouse is approximately $300,000. Our typical treehouses are between 200 and 800 square feet.',
    lowUsd: 300_000,
  },
  {
    builder: 'Nelson Treehouse',
    url: 'https://nelsontreehouse.com/design-build/',
    read: READ,
    quote:
      'The minimum cost of our design services for a fully permitted and engineered treehouse is about $30,000. Our design services account for 10 to 15 percent of the total price.',
    lowUsd: 30_000,
  },
];

/** Add-ons Tree Top Builders price separately on their own page. */
export const ADD_ON_ANCHORS: Array<{ key: string; label: string; lowUsd: number; highUsd: number }> = [
  { key: 'swing', label: 'Swing, rope & bucket, flags', lowUsd: 10, highUsd: 150 },
  { key: 'pole', label: 'Fireman’s pole, cargo net or small zip line', lowUsd: 300, highUsd: 1_000 },
  { key: 'zip', label: 'Long zip line or cable bridge', lowUsd: 2_000, highUsd: 8_000 },
  { key: 'engineered', label: 'Engineer-prepared plans', lowUsd: 1_500, highUsd: 10_000 },
];

export const ADD_ON_SOURCE = {
  builder: 'Tree Top Builders',
  url: 'https://treetopbuilders.net/pages/tree-house-pricing',
  read: READ,
};

/**
 * The nine things Tree Top Builders say drive the price, in their own framing. The planner shows
 * these whatever the inputs, because the honest answer to "what will it cost" is mostly "here is
 * what moves it".
 */
export const COST_FACTORS = [
  'Size and scope',
  'Number of platforms',
  'Location and travel distance',
  'Height off the ground',
  'Accessories',
  'How hard the site is to reach',
  'Engineering and design needs',
  'Material quality',
  'Project-specific challenges',
];

/** Why a number here is never a quote — their words, not ours. */
export const NO_QUOTE_REASON =
  'Tree Top Builders put it plainly on their own pricing page: an exact quote is not possible without knowing the trees a builder will be working with, and the materials and specification you choose.';
