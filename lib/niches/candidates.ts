// lib/niches/candidates.ts
//
// Candidate niches for the supply-density probe (docs/NICHE_DISCOVERY.md).
//
// ⚠️ THE ORGANISING RULE: SEARCH FOR THE STRUCTURE, NOT THE TRADE. Our own measured record is
// that trade-shaped geo domains lose. 43 towing campaigns, 24 domains owned, found 6.4 tow
// companies per city — dense enough that Google's local pack is full, the intent is an
// emergency (people tap the map pin, they do not read), and across 92 connected domains the
// whole fleet earned 18 clicks in 28 days. The dome cohort was the opposite on every axis:
// ~2 builders per STATE, a buyer who plans for months, and a free calculator to answer their
// first question. So the candidates below are unusual STRUCTURES, not trades: when the thing
// itself is rare, supply is thin, the local pack starves, and organic can win the page.
//
// `ticket` and `intent` are HAND-SET JUDGEMENTS, not measurements — the probe measures supply
// density and nothing else. They are here so the ranking is explicit about what it assumes;
// a wrong one should be edited, never quietly averaged away.

export type Ticket = 'low' | 'mid' | 'high';
/** `emergency` = they tap the first map pin. `considered` = they research for weeks. */
export type Intent = 'emergency' | 'considered';
/** How well a tool we already own answers the searcher's first question. */
export type ToolFit = 'none' | 'partial' | 'direct';

export type NicheCandidate = {
  key: string;
  label: string;
  /** What we ask Places. Plural/near-me phrasing is deliberate: it is how supply lists itself. */
  queries: string[];
  ticket: Ticket;
  intent: Intent;
  toolFit: ToolFit;
  /** Why it is on the list, and what would take it off. One line, readable at 3am. */
  note: string;
};

export const NICHE_CANDIDATES: NicheCandidate[] = [
  // ---- The proven shape (running; here as the benchmark the others are scored against) ----
  {
    key: 'dome_builder',
    label: 'Geodesic / monolithic domes',
    queries: ['geodesic dome builder', 'dome home contractor'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'direct',
    note: 'LIVE cohort. 28 orgs nationally, ~2 per state. DomeSketch is the calculator. The benchmark.',
  },

  // ---- Alternative structures: rare enough that not every GC builds one ----
  {
    key: 'yurt',
    label: 'Yurts',
    queries: ['yurt builder', 'yurt dealer'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Same shape as domes: scattered makers, months of planning, a size/platform decision a tool could answer.',
  },
  {
    key: 'pole_barn',
    label: 'Pole barns / post-frame',
    queries: ['pole barn builder', 'post frame construction'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'High ticket, rural, kit-and-erector split like domes. Risk: dense in farm states — the probe decides.',
  },
  {
    key: 'timber_frame',
    label: 'Timber frame homes',
    queries: ['timber frame builder', 'post and beam home builder'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Very high ticket, national makers + local raisers. Long research window.',
  },
  {
    key: 'container_building',
    label: 'Shipping-container builds',
    queries: ['shipping container home builder', 'container office builder'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Heavily searched, thin real supply — a lot of the SERP is blogs, which is the gap.',
  },
  {
    key: 'treehouse',
    label: 'Treehouse builders',
    queries: ['treehouse builder', 'custom treehouse company'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'none',
    note: 'Extremely thin supply, high ticket, the most research-heavy buyer on this list.',
  },
  {
    key: 'earth_natural',
    label: 'Earthbag / cob / straw-bale',
    queries: ['natural building contractor', 'straw bale home builder'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Thinnest supply here. Risk: the buyer is often owner-builder, so lead value may not follow ticket.',
  },
  {
    key: 'storm_shelter',
    label: 'Storm shelters / safe rooms',
    queries: ['storm shelter installer', 'safe room contractor'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Regional (tornado alley) so nationally thin. ⚠️ Spikes with weather — seasonal, not steady.',
  },
  {
    key: 'backyard_studio',
    label: 'Backyard studios / offices',
    queries: ['backyard office builder', 'garden studio builder'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Post-2020 category, supply still forming. Overlaps ADU, which is dense in CA — probe separately.',
  },
  {
    key: 'barrel_sauna',
    label: 'Saunas / cold plunge installs',
    queries: ['sauna installer', 'cold plunge installation'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Fast-growing demand, mostly national e-commerce — local install is the unserved half.',
  },
  {
    key: 'dock_boat_lift',
    label: 'Docks / boat lifts',
    queries: ['dock builder', 'boat lift installer'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Geographically thin BY DEFINITION — waterfront only — so most metros have near-zero supply.',
  },
  {
    key: 'equestrian',
    label: 'Horse barns / riding arenas',
    queries: ['horse barn builder', 'riding arena construction'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'High ticket, specialist builders, wealthy buyer who plans. Rural-dense risk like pole barns.',
  },
  {
    key: 'greenhouse',
    label: 'Commercial / residential greenhouses',
    queries: ['greenhouse builder', 'greenhouse installer'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'direct',
    note: 'Growing-dome overlap: DomeSketch already reaches it, and Growing Spaces is in the directory.',
  },

  // ---- Wave 2 (2026-09-23). Added AFTER the classifier was validated against a human, which
  // changed the method: the supply probe was only ever a cheap pre-filter to avoid spending on
  // an untrusted SERP read. A SERP check costs about $0.002, so these go straight to the real
  // measurement. ⚠️ The probe also misled twice — `earth_natural` read 16.2/metro because
  // "natural building contractor" matches every GC, and the Places sweep missed the builder
  // ranking FIRST for its own query. A proxy that can be wrong in both directions is not worth
  // gating on when the true measure is nearly free.
  {
    key: 'zip_line',
    label: 'Zip lines & aerial courses',
    queries: ['zip line builder', 'backyard zip line installation'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Adjacent to treehouses — Tree Top Builders and Treehouse Experts both sell them, so supply overlaps a cohort that already worked.',
  },
  {
    key: 'skate_ramp',
    label: 'Skate ramps & pump tracks',
    queries: ['skate ramp builder', 'backyard pump track builder'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Treecraft lists skate ramps beside treehouses. Rare structure, enthusiast buyer who researches.',
  },
  {
    key: 'climbing_wall',
    label: 'Home climbing walls',
    queries: ['home climbing wall builder', 'residential climbing wall installation'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Specialist trade, almost no local supply, buyer reads for weeks. ⚠️ Commercial gyms may dominate and are a different market.',
  },
  {
    key: 'grain_bin_home',
    label: 'Grain bin & silo homes',
    queries: ['grain bin home builder', 'silo home conversion'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'The rarest structure on the list. Risk is the opposite of density: there may be almost no searches either.',
  },
  {
    key: 'earth_sheltered',
    label: 'Earth-sheltered & berm homes',
    queries: ['earth sheltered home builder', 'berm home construction'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Dome-adjacent; monolithic dome builders often do these, so DomeSketch is nearer here than elsewhere.',
  },
  {
    key: 'natural_pool',
    label: 'Natural swimming pools',
    queries: ['natural swimming pool builder', 'natural pond pool construction'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'none',
    note: 'High ticket, distinct from the saturated pool trade. ⚠️ Ordinary pool builders may swamp the query — the check will say.',
  },
  {
    key: 'wine_cellar',
    label: 'Wine cellars',
    queries: ['custom wine cellar builder', 'wine cellar installation'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'none',
    note: 'Specialist, high ticket, wealthy buyer who plans. Likely thin local supply outside a few metros.',
  },
  {
    key: 'observatory',
    label: 'Backyard observatories',
    queries: ['backyard observatory builder', 'home observatory dome'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'partial',
    note: 'Genuinely a dome — DomeSketch adjacent. Tiny market, but tiny markets are exactly where nobody has built the page.',
  },
  {
    key: 'sport_court',
    label: 'Sport courts & batting cages',
    queries: ['backyard sport court builder', 'batting cage installation'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'none',
    note: 'Franchise networks exist here, which usually means a full pack — included to find out rather than assume.',
  },
  {
    key: 'bunker',
    label: 'Bunkers & underground shelters',
    queries: ['underground bunker builder', 'bomb shelter installation'],
    ticket: 'high',
    intent: 'considered',
    toolFit: 'none',
    note: 'Adjacent to storm shelters, which failed on regional density. ⚠️ Check the SERP is not dominated by prepper content farms.',
  },

  // ---- Controls: included ON PURPOSE so the probe is falsifiable ----
  {
    key: 'towing',
    label: 'Towing (control — known loss)',
    queries: ['towing service', 'tow truck company'],
    ticket: 'low',
    intent: 'emergency',
    toolFit: 'none',
    note: 'CONTROL. 43 campaigns, 18 clicks. If the probe does not rank this last, the probe is wrong.',
  },
  {
    key: 'deck_builder',
    label: 'Decks (control — dense but we have the tool)',
    queries: ['deck builder', 'deck contractor'],
    ticket: 'mid',
    intent: 'considered',
    toolFit: 'direct',
    note: 'CONTROL. DeckSketch answers the first question, but every GC builds decks — tests whether tool beats density.',
  },
];
