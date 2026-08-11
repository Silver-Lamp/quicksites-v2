// lib/domains/nameSuggestions.ts
//
// Turn a real business name into domain candidates worth checking.
//
// ⚠️ THE INPUT IS MESSY IN WAYS A SLUGIFIER HANDLES BADLY. These are Google listing names, and
// the ones in one real Renton cohort include:
//     "Torero's Cocina Mexicana & Cantina - Renton"
//     "Taqueria Los Potrillos #5"
//     "Wild Garlic Chinese Restaurant"
// Naive stripping gives `toreroscocinamexicanacantinarenton` — 34 characters nobody will type,
// and not a name anyone would recognise as theirs. The work here is deciding what to DROP.
//
// ⚠️ AND WHAT WE DROP IS A JUDGEMENT ABOUT SOMEONE'S NAME, so the rules are conservative:
// trailing city tags, branch numbers and generic category words go; the distinctive part always
// stays. "Taqueria Los Potrillos #5" → `lospotrillos`, never `potrillos` — shortening past the
// words that make it theirs produces something that belongs to someone else.
//
// ⚠️ NOTHING HERE CLAIMS AVAILABILITY. This produces candidates; `registrar.checkAvailability`
// answers whether they can be bought, and that answer is live and goes stale. A suggestion shown
// without a fresh check is a promise we cannot keep, and the moment it breaks is the moment an
// owner has already decided they want it.

/** Words that describe the CATEGORY rather than the business. Dropped from the core name. */
const CATEGORY_WORDS = new Set([
  'restaurant', 'restaurants', 'cafe', 'café', 'kitchen', 'deli', 'bar', 'grill', 'cantina',
  'bakery', 'taqueria', 'pizzeria', 'buffet', 'diner', 'eatery', 'bistro', 'shop', 'house',
  'chinese', 'mexican', 'thai', 'vietnamese', 'japanese', 'korean', 'indian', 'italian',
  // ⚠️ Spanish too. Half this cohort is Mexican-American and an English-only list left
  // "Torero's Cocina Mexicana" as `toreroscocinamexicana` — 21 characters of category.
  'cocina', 'mexicana', 'mexicano', 'birrieria', 'panaderia', 'carniceria', 'mariscos',
  'antojitos', 'pupuseria', 'tortilleria',
]);

/** Leading articles carry no signal in a domain. */
const ARTICLES = new Set(['the', 'a', 'an', 'el', 'la', 'los', 'las']);

function words(name: string): string[] {
  return String(name ?? '')
    // "#5" is a branch number, "- Renton" a location tag: both are about WHICH one, not WHO.
    .replace(/#\s*\d+/g, ' ')
    .replace(/\s[-–—]\s.*$/, ' ')
    .replace(/&/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** The full name, minus only branch/location tags and a leading article. */
export function coreName(name: string): string {
  const w = words(name).filter((x, i) => !(i === 0 && ARTICLES.has(x)));
  return w.join('');
}

/**
 * The name with category words removed — often what an owner would actually pick.
 *
 * ⚠️ RETURNS EMPTY WHEN TRIMMING WOULD GO TOO FAR, and that guard is the whole point. "Wild
 * Garlic Chinese Restaurant" → `wildgarlic`, good. "Enjoy Teriyaki" → `enjoy`, which is not their
 * name and would be a bad thing to have bought. The rule: only offer the short form when it keeps
 * a distinctive word AND the original had something left to lose.
 */
export function shortName(name: string): string {
  const w = words(name).filter((x, i) => !(i === 0 && ARTICLES.has(x)));
  const distinctive = w.filter((x) => !CATEGORY_WORDS.has(x));
  if (!distinctive.length) return '';
  if (distinctive.length === w.length) return ''; // nothing was dropped; not a second option
  const joined = distinctive.join('');
  return joined.length >= 5 ? joined : '';
}

export type DomainCandidate = {
  label: string;
  /** Why this one is being offered — shown to the owner, never inferred by them. */
  kind: 'their-name' | 'name-and-city' | 'searchable';
};

/**
 * Candidates for a business, best-first.
 *
 * ⚠️ TWO KINDS, AND THE DIFFERENCE IS EXPLAINED RATHER THAN RANKED SILENTLY. An owner wants their
 * shop's name; a name people SEARCH for is often a different string ("renton teriyaki"). Both are
 * legitimate and they are not the same purchase, so both are offered and labelled. What we must
 * not do is quietly push the searchable one because it suits our ranking story — that is advice
 * dressed as a default.
 */
export function domainCandidates(opts: {
  businessName: string;
  city?: string | null;
  /** A plain category word, e.g. "teriyaki", "tacos" — the owner's, not a Places label. */
  category?: string | null;
}): DomainCandidate[] {
  const core = coreName(opts.businessName);
  const short = shortName(opts.businessName);
  const city = String(opts.city ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cat = String(opts.category ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const out: DomainCandidate[] = [];
  const push = (label: string, kind: DomainCandidate['kind']) => {
    // ⚠️ 24, not 40. `toreroscocinamexicanacantinamenu` is a valid domain and nobody will ever
    // type it, read it off a menu, or say it down a phone. A suggestion that cannot be used is
    // not a suggestion, and offering it makes the good ones harder to see.
    if (label && label.length >= 3 && label.length <= 24 && !out.some((c) => c.label === label)) {
      out.push({ label, kind });
    }
  };

  // ⚠️ BOTH FORMS, SHORTEST FIRST, RATHER THAN OUR PICK. Which of `toreros` and
  // `toreroscocinamexicana` is "their name" is not a question we can answer from a listing string
  // — it is the owner's own sense of what they are called. Offering both and letting them choose
  // costs one extra availability check and removes a guess about somebody's identity.
  // ⚠️ Not when the "short name" is just the city. "Renton Deli" trims to `renton` — a city, not
  // a business, almost certainly taken, and not theirs in any sense. shortName cannot see this
  // because it does not know where they are; this layer does.
  if (short && short !== city) push(short, 'their-name');
  if (core) push(core, 'their-name');
  // Not when the name already contains it — `rentondelirenton`.
  if (core && city && !core.includes(city)) push(`${core}${city}`, 'name-and-city');
  if (city && cat) push(`${city}${cat}`, 'searchable');
  // Built off the SHORT form when there is one — appending to an already-long name produces the
  // unusable strings the cap above then silently drops.
  const stem = short && short !== city ? short : core;
  if (stem) push(`${stem}menu`, 'their-name');
  if (stem) push(`order${stem}`, 'their-name');

  return out;
}
