// lib/proof/queryKind.ts
//
// What KIND of search is this — the customer's own city+trade phrase, a plain trade search, or
// somebody else's name? One implementation, imported by both consumers, because they disagree at
// their peril: `/proof/rankings` shows a prospect which queries we hold, and the internal rate card
// decides which domains a rep is allowed to pitch as "on page one". Two copies of these rules would
// eventually qualify a domain on one surface and not the other.
//
// ⚠️ These rules replaced a hand-typed `kind` that nothing could regenerate (see #885). Validated
// against the 56 queries the old hand-labelled snapshot shared with a fresh pull: 54 agreed.

export type QueryKind = 'city_trade' | 'generic' | 'other';

/** Trade words, longest first — the strip in cityKeyFor depends on that order. */
export const TRADE_TOKENS = [
  'exteriorcleaning', 'roofcleaning', 'drivewayrepair', 'windowclean', 'pressurewashing',
  'roadsideassistance', 'towtruck', 'towing', 'roadside', 'wrecker', 'tow',
] as const;

const NEAR_ME = ['nearme', 'aroundme', 'cercademi', 'closetome'];

/** Words carrying no place or business identity — a query of only these is a plain trade search. */
const FILLER = new Set([
  'a', 'the', 'and', 'of', 'for', 'my', 'me', 'i', 'is', 'are', 'in', 'to', 'service', 'services',
  'company', 'companies', 'cost', 'price', 'prices', 'cheap', 'best', 'local', 'emergency', 'hour',
  'hours', 'open', 'now', 'number', 'phone', 'call', 'truck', 'trucks', 'car', 'cars', 'vehicle',
  'auto', 'motorcycle', 'flatbed', 'heavy', 'duty', 'accident', 'junk', 'free', 'quote', 'near',
  'around', 'close', 'servicio', 'de', 'cerca', 'mi', 'gruas', 'grua',
]);

const norm = (x: unknown): string => String(x ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The place part of a host: graftontowing.com -> "grafton", pnw-exteriorcleaning.com -> "pnw".
 * Strips the trade word out of the hostname, longest match first so "towing" wins over "tow".
 */
export function cityKeyFor(host: string): string {
  let h = norm(
    String(host ?? '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/^sc-domain:/, '')
  ).replace(/(com|net|org|ai|menu)$/, '');
  for (const t of TRADE_TOKENS) {
    if (h.includes(t)) {
      h = h.replace(t, '');
      break;
    }
  }
  return h;
}

export function classifyQuery(query: string, host: string): QueryKind {
  const raw = String(query ?? '').toLowerCase();
  const q = norm(query);

  // Someone probing a directory listing, not searching for a service.
  if (raw.includes('inurl:') || raw.includes('http')) return 'other';

  // "near me" is an intent marker that outranks any place in the string: "car towing near me
  // bonney lake" is a proximity search, not a search for our city.
  if (NEAR_ME.some((n) => q.includes(n))) return 'generic';

  const city = cityKeyFor(host);
  if (city && city.length >= 3 && q.includes(city)) return 'city_trade';

  // A 5-digit token is a US ZIP, which is a PLACE and not filler. Caught by the hand labels
  // disagreeing with a first version of these rules: "towing 53024" is Grafton's own ZIP and
  // reads as a generic trade search to anything that throws bare digits away.
  if (/(^|[^0-9])\d{5}([^0-9]|$)/.test(raw)) return 'city_trade';

  // Nothing of ours in it. If only trade and filler words remain it is a plain trade search;
  // a surviving token names somebody or somewhere else.
  const residual = raw
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !(TRADE_TOKENS as readonly string[]).includes(t) && !FILLER.has(t) && !/^\d+$/.test(t));

  return residual.length === 0 ? 'generic' : 'other';
}
