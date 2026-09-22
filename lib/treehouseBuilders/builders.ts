// lib/treehouseBuilders/builders.ts
//
// The treehouse builder registry — the supply side of the cohort (docs/TREEHOUSE_COHORT.md).
//
// ⚠️ THIS TRADE IS NATIONAL, NOT LOCAL, AND THAT IS THE WHOLE REASON THE SEARCH RESULTS ARE
// EMPTY. A Places sweep of five states found ~1–2 real builders each and ZERO in Tennessee; what
// it mostly returned was treehouse RENTALS — cabins, Airbnb listings, an alpaca farm, a clothing
// store, a paper manufacturer and a car-repair shop, all with "treehouse" in the name. The real
// builders are a few dozen firms who travel to the client. So supply is recorded here as
// businesses with a stated base and, where they say so, a stated service area — never as "the
// builders in your state", because for most states there are none.
//
// ⚠️ `servesStates` IS ONLY EVER WHAT A COMPANY SAYS ABOUT ITSELF. Treehouse Experts names eight
// states on their own site, so those are listed. Nelson says "around the world" and Tree Top
// Builders says nothing at all — so neither gets a state list, and a state page must not imply
// one. `serviceAreaQuote` carries their exact words so the page can show the claim rather than
// our paraphrase of it. An empty `servesStates` means "they have not said", never "they do not".
//
// ⚠️ NO SAFETY, LICENSING OR INSURANCE CLAIMS, EVER — not even where a company makes them about
// itself. These are structures children climb into; repeating someone else's safety claim on our
// page makes it ours. Link to them and let them say it.

export type BuilderSource = {
  url: string;
  /** What this source supports, and the date it was read. */
  note: string;
  read: string;
};

export type TreehouseBuilder = {
  id: string;
  name: string;
  url: string;
  /** Where they say they are based. Empty when their site does not say. */
  baseCity?: string;
  baseState?: string;
  /** Two-letter states the company ITSELF names as places it builds. Empty = not stated. */
  servesStates: string[];
  /** Their exact words about where they work, shown verbatim beside the entry. */
  serviceAreaQuote?: string;
  /** What they say they build, in our words, supported by `sources`. */
  summary: string;
  /** Prices only when the company publishes them, quoted with the date read. */
  pricingNote?: string;
  sources: BuilderSource[];
};

const READ = '2026-09-22';

export const TREEHOUSE_BUILDERS: TreehouseBuilder[] = [
  {
    id: 'treehouse-experts',
    name: 'Treehouse Experts',
    url: 'https://www.treehouseexperts.com/',
    baseCity: 'Atlanta',
    baseState: 'GA',
    // The only builder so far who names states. Everything here is their own sentence.
    servesStates: ['GA', 'TN', 'FL', 'AL', 'SC', 'NC', 'NJ', 'CT'],
    serviceAreaQuote:
      'Based in Atlanta, GA, we build all over North America primarily on the East Coast including Georgia, Tennessee, Florida, Alabama, South Carolina, North Carolina, New Jersey, Connecticut, etc.',
    summary:
      'Residential and commercial treehouses, playgrounds, playhouses, platforms, ziplines and suspended bridges.',
    pricingNote:
      'Their site lists suspended platforms from $5,400 and vacation-rental treehouses from $60,000 (read 2026-09-22).',
    sources: [
      { url: 'https://www.treehouseexperts.com/', note: 'Base, the eight-state service area sentence, what they build, and the published starting prices.', read: READ },
    ],
  },
  {
    id: 'nelson-treehouse',
    name: 'Nelson Treehouse',
    url: 'https://nelsontreehouse.com/design-build/',
    baseCity: 'Fall City',
    baseState: 'WA',
    // "Around the world" is not a state list. Left empty on purpose.
    servesStates: [],
    serviceAreaQuote:
      'Although we have the honor of building treehouses around the world, we remain a small family-owned business rooted in the rural town of Fall City, Washington.',
    summary:
      'Design-build custom treehouses. Their site notes that crew travel, accommodation and freight are significant costs on projects far from their headquarters.',
    sources: [
      { url: 'https://nelsontreehouse.com/design-build/', note: 'Fall City WA base, the "around the world" wording, and travel/logistics costs on distant projects.', read: READ },
    ],
  },
  {
    id: 'the-treehouse-guys',
    name: 'The Treehouse Guys',
    url: 'https://thetreehouseguys.com/',
    servesStates: [],
    serviceAreaQuote: 'all across the country',
    summary:
      'Custom treehouses for private clients, vacation rentals, and accessible treehouses for public parks and camps.',
    sources: [
      { url: 'https://thetreehouseguys.com/', note: 'What they build and the "all across the country" phrase. Their site states no home state.', read: READ },
    ],
  },
  {
    id: 'tree-top-builders',
    name: 'Tree Top Builders',
    url: 'https://www.treetopbuilders.net/',
    baseState: 'PA',
    // ⚠️ States nothing about a service area, yet ranked first organically in BOTH Phoenix and
    // Portland during the 2026-09-22 SERP check — which is the clearest evidence in this file
    // that the trade is national. We still do not put words in their mouth.
    servesStates: [],
    summary:
      'Custom treehouses and other tree-attached structures — residential, rental, commercial and playscape — plus design, engineering and consulting for self-builders.',
    sources: [
      { url: 'https://www.treetopbuilders.net/', note: 'Pennsylvania base and the range of structures; portfolio shows PA and VA projects. No service area is stated on the site.', read: READ },
    ],
  },
  {
    id: 'wild-tree-woodworks',
    name: 'Wild Tree Woodworks',
    url: 'https://www.wildtreewoodworks.com/',
    baseCity: 'Seattle',
    baseState: 'WA',
    servesStates: [],
    summary:
      'Custom treehouses and elevated structures since 2013 — tree homes and offices, kids’ treehouses, canopy walks, open-air treehouses and houseboats.',
    sources: [
      { url: 'https://www.wildtreewoodworks.com/', note: 'Seattle base, founded 2013, and the structure types. No service area or pricing stated.', read: READ },
    ],
  },
  {
    id: 'o2-treehouse',
    name: 'O2 Treehouse',
    url: 'https://www.o2treehouse.com/',
    servesStates: [],
    summary: 'Luxury treehouses, described on their site as artisan craftsmanship with engineering-led design.',
    sources: [
      { url: 'https://www.o2treehouse.com/', note: 'What they build. Their site names a Santa Cruz, California project but states no base or service area.', read: READ },
    ],
  },
  {
    id: 'buffalo-treehouse',
    name: 'Buffalo Treehouse',
    url: 'https://www.buffalotreehouse.com/',
    baseState: 'NY',
    servesStates: [],
    summary: 'Custom treehouse builder listed in The Treehouse Guide’s directory of professional builders.',
    sources: [
      { url: 'https://thetreehouseguide.com/links-builders.htm', note: 'Listed as a New York treehouse builder. ⚠️ Directory listing only — their own site has not been read yet.', read: READ },
    ],
  },
  {
    id: 'treecraft-design-build',
    name: 'Treecraft Design-Build',
    url: 'https://www.treecraftdesignbuild.com/',
    baseState: 'CO',
    servesStates: [],
    summary:
      'Design-build firm for custom treehouses, cabins, playhouses, playgrounds and other small-scale structures.',
    sources: [
      { url: 'https://thetreehouseguide.com/links-builders.htm', note: 'Listed as a Colorado (Boulder/Fort Collins) treehouse builder. ⚠️ Directory listing only — their own site has not been read yet.', read: READ },
    ],
  },
  {
    id: 'creative-treehouse-design',
    name: 'Creative Treehouse Design',
    url: 'http://www.creativetreehousedesign.com/',
    baseState: 'NC',
    servesStates: [],
    summary: 'North Carolina treehouse design and build, listed by Google as a general contractor.',
    sources: [
      { url: 'https://www.google.com/maps', note: 'Google Places listing: North Carolina, primary type "General Contractor". ⚠️ Their own site has not been read yet.', read: READ },
    ],
  },
  {
    id: 'cape-cod-treehouse',
    name: 'Cape Cod Treehouse',
    url: 'https://capecodtreehouse.com/',
    baseState: 'MA',
    servesStates: [],
    summary: 'Massachusetts treehouse builder listed in The Treehouse Guide’s directory.',
    sources: [
      { url: 'https://thetreehouseguide.com/links-builders.htm', note: 'Listed as a Massachusetts treehouse builder. ⚠️ Directory listing only — their own site has not been read yet.', read: READ },
    ],
  },
  {
    id: 'artistree',
    name: 'ArtisTree',
    url: 'https://www.artistreehomes.com/',
    baseCity: 'Sebastopol',
    baseState: 'CA',
    servesStates: [],
    summary: 'California treehouse builder listed in The Treehouse Guide’s directory.',
    sources: [
      { url: 'https://thetreehouseguide.com/links-builders.htm', note: 'Listed as a Sebastopol, California treehouse builder. ⚠️ Directory listing only — their own site has not been read yet.', read: READ },
    ],
  },
  {
    id: 'azzan-arts',
    name: 'Azzan Arts',
    url: 'https://www.azzanarts.com/',
    baseCity: 'Austin',
    baseState: 'TX',
    servesStates: [],
    summary: 'Austin, Texas treehouse builder listed in The Treehouse Guide’s directory.',
    sources: [
      { url: 'https://thetreehouseguide.com/links-builders.htm', note: 'Listed as an Austin, Texas treehouse builder. ⚠️ Directory listing only — their own site has not been read yet.', read: READ },
    ],
  },
];

/** An entry we have read the company's OWN site for. The rest are directory listings. */
export const isFirstHand = (b: TreehouseBuilder): boolean =>
  b.sources.some((s) => !s.note.includes('has not been read yet'));

/**
 * Builders relevant to a state page, in the only two honest senses:
 *   `basedHere`  — their own site or listing puts them in the state.
 *   `servesHere` — the company itself names the state as somewhere it builds.
 * A builder who has said nothing appears in neither, and the page says so rather than guessing.
 */
export function buildersForState(state: string): {
  basedHere: TreehouseBuilder[];
  servesHere: TreehouseBuilder[];
} {
  const code = state.toUpperCase();
  return {
    basedHere: TREEHOUSE_BUILDERS.filter((b) => b.baseState === code),
    servesHere: TREEHOUSE_BUILDERS.filter((b) => b.baseState !== code && b.servesStates.includes(code)),
  };
}

/** How many builders a state page could honestly name. Below 2, do not buy the domain. */
export function stateCoverage(state: string): number {
  const { basedHere, servesHere } = buildersForState(state);
  return basedHere.length + servesHere.length;
}
