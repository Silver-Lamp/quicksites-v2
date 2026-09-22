// lib/treehouseBuilders/estimate.ts
//
// The treehouse planner's brain. PURE — no I/O, no rendering.
//
// ⚠️ IT DOES NOT PRICE A TREEHOUSE. It positions what someone described against the ranges three
// builders publish (lib/treehouseBuilders/costData.ts) and says whose figures each bound came
// from. The difference is not pedantry: a number we computed is our claim about someone else's
// work, and the builders themselves say a real price is impossible without seeing the trees.
//
// ⚠️ THE QUESTIONS ARE THE PRODUCT, NOT THE NUMBER. Someone researching a treehouse cannot get a
// quote from a web page, but they CAN arrive at the first call knowing what they will be asked.
// That is the thing a page can honestly deliver, and `builderQuestions()` is it — the range is
// what gets them to read it.
//
// ⚠️ NOTHING HERE TOUCHES STRUCTURE, ATTACHMENT OR SAFETY. No span tables, no bolt sizing, no
// "your tree will hold it". These are structures children climb into; the moment a tool implies a
// design is sound it has made a claim only an engineer who has seen the tree can make.

import { ADD_ON_ANCHORS, COST_FACTORS, NO_QUOTE_REASON, PRICE_ANCHORS } from '@/lib/treehouseBuilders/costData';

export type Scale = 'platform' | 'kids' | 'family' | 'habitable';
export type Access = 'easy' | 'tight';
export type Materials = 'standard' | 'premium';

export type PlannerInput = {
  scale: Scale;
  enclosed: boolean;
  access: Access;
  materials: Materials;
  /** True when they want permitted / engineered drawings. */
  engineered: boolean;
  /** Keys from ADD_ON_ANCHORS. */
  addOns: string[];
};

/**
 * Each band's bounds are lifted from a specific published figure — never interpolated. The
 * `basis` string is rendered beside the range so a reader can check us.
 */
const BANDS: Record<Scale, { lowUsd: number; highUsd: number; basis: string; label: string }> = {
  platform: {
    lowUsd: 5_400,
    highUsd: 9_000,
    label: 'A platform or simple deck in the trees',
    basis:
      'Treehouse Experts publish suspended platforms from $5,400; Tree Top Builders say treehouses start around $9,000.',
  },
  kids: {
    lowUsd: 9_000,
    highUsd: 36_000,
    label: 'A kids’ treehouse',
    basis:
      'Tree Top Builders’ published range starts at $9,000, and they price an example Baltimore treehouse at $26,000–$36,000.',
  },
  family: {
    lowUsd: 26_000,
    highUsd: 60_000,
    label: 'A large family treehouse',
    basis:
      'Between Tree Top Builders’ $26,000–$36,000 example and the $60,000 Treehouse Experts publish as a starting point for rental-grade treehouses.',
  },
  habitable: {
    lowUsd: 60_000,
    highUsd: 300_000,
    label: 'Somewhere you could sleep',
    basis:
      'From the $60,000 Treehouse Experts publish for rental treehouses up to Nelson Treehouse’s stated baseline of approximately $300,000 for a fully designed and built custom treehouse.',
  },
};

export type PlannerResult = {
  scaleLabel: string;
  lowUsd: number;
  highUsd: number;
  /** Whose published figures the bounds came from. Rendered with the range, never hidden. */
  basis: string;
  /** What the answers moved, in plain words. Empty when nothing was adjusted. */
  adjustments: string[];
  addOnLowUsd: number;
  addOnHighUsd: number;
  questions: string[];
  factors: string[];
  noQuoteReason: string;
};

/**
 * What a builder will ask, tailored a little by the answers. Sourced from what the builders
 * themselves say drives a price — not invented to look thorough.
 */
export function builderQuestions(input: PlannerInput): string[] {
  const q = [
    'What species are the trees, and roughly how thick is each trunk at chest height?',
    'How many trees, and how far apart are they?',
    'How far is the site from a road, and can a vehicle get near it?',
    'How high off the ground do you want the floor?',
    'Who will use it, and will anyone sleep in it?',
    'What is your budget range?',
  ];
  if (input.engineered) {
    q.push('Do you need permitted, engineer-stamped drawings, and has your county been asked what it requires?');
  }
  if (input.access === 'tight') {
    q.push('How will materials reach the site — by hand, by machine, or is there no vehicle access at all?');
  }
  if (input.scale === 'habitable') {
    q.push('Do you want power, water or heat, and is there a supply near the trees?');
  }
  return q;
}

export function estimate(input: PlannerInput): PlannerResult {
  const band = BANDS[input.scale];
  let low = band.lowUsd;
  let high = band.highUsd;
  const adjustments: string[] = [];

  // Each adjustment below is justified by a published statement, and says so in its own words.
  if (input.enclosed && input.scale !== 'platform') {
    high = Math.round(high * 1.25);
    adjustments.push('Walls, a roof and windows push you toward the upper end — size and scope is the first thing builders list.');
  }
  if (input.materials === 'premium') {
    high = Math.round(high * 1.2);
    adjustments.push(
      'Tree Top Builders note composite or Ipe decking can cost two to five times pressure-treated, which lifts the top of the range rather than the bottom.',
    );
  }
  if (input.access === 'tight') {
    low = Math.round(low * 1.1);
    adjustments.push('Difficult site access is on every builder’s cost list — everything arrives by hand.');
  }

  const chosen = ADD_ON_ANCHORS.filter((a) => input.addOns.includes(a.key));
  const addOnLowUsd = chosen.reduce((s, a) => s + a.lowUsd, 0);
  const addOnHighUsd = chosen.reduce((s, a) => s + a.highUsd, 0);

  return {
    scaleLabel: band.label,
    lowUsd: low,
    highUsd: high,
    basis: band.basis,
    adjustments,
    addOnLowUsd,
    addOnHighUsd,
    questions: builderQuestions(input),
    factors: COST_FACTORS,
    noQuoteReason: NO_QUOTE_REASON,
  };
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Always a range. A single formatted number would read as a quote, which is the whole risk. */
export function formatRange(lowUsd: number, highUsd: number): string {
  return `${usd.format(lowUsd)} – ${usd.format(highUsd)}`;
}

/** Every builder whose published figures back any band, for the sources list under the result. */
export function anchorsUsed() {
  return PRICE_ANCHORS;
}
