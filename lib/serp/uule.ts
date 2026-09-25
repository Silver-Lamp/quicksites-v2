// lib/serp/uule.ts
//
// Build a Google search URL that carries the LOCATION IN THE URL, so a hand check cannot silently
// run from the wrong city.
//
// ⚠️ WHY THIS REPLACES THE DEVTOOLS STEP. The worksheet told the checker to set Chrome →
// DevTools → Sensors → Location. It failed silently TWICE in two days on the same niche: the first
// run stamped `28801, Asheville, NC` and the second `East Renton Highlands, Washington`, both while
// measuring queries meant to be Austin's. The searches still ran, results still looked plausible,
// and only the footer at the very bottom of the page said otherwise. A setup step that fails
// invisibly and is verified at the END is the wrong shape; the location belongs in the link.
//
// ⚠️ THIS MODULE BUILDS A URL FOR A PERSON TO OPEN. It never fetches. Automated querying of Google
// is against its terms and this repo does not do it (CLAUDE.md) — the whole point of a hand check is
// that a human looks at the real page, which is also the only thing that has caught what the SERP
// API cannot see.

/**
 * Google's `uule` encoding of a canonical location name.
 *
 * Format: a fixed prefix, then ONE character encoding the name's length, then the base64 of the
 * name. The length character comes from a 64-symbol alphabet indexed by the byte length, which is
 * why names longer than 63 bytes cannot be encoded — every canonical name we use is far shorter.
 *
 * ⚠️ The canonical name must be Google's own, comma-separated, no spaces after the commas:
 * `Austin,Texas,United States`. That is exactly the string `lib/serp/checkSets.ts` already stores
 * and DataForSEO already accepts, so the hand check and the API check are pointed at the SAME place
 * by construction rather than by someone retyping a city.
 */
const LENGTH_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function uuleFor(canonicalName: string): string {
  const name = String(canonicalName ?? '').trim();
  if (!name) throw new Error('uuleFor: a canonical location name is required');
  const bytes = Buffer.from(name, 'utf8');
  if (bytes.length >= LENGTH_ALPHABET.length) {
    // Fail loudly rather than emit a token Google will ignore — an ignored uule silently falls back
    // to the searcher's IP, which is the exact failure this module exists to remove.
    throw new Error(`uuleFor: "${name}" is too long to encode (${bytes.length} bytes)`);
  }
  return `w+CAIQICI${LENGTH_ALPHABET[bytes.length]}${bytes.toString('base64')}`;
}

/**
 * A Google results URL for a human to open, pinned to `canonicalName`.
 *
 * `pws=0` turns off personalisation from prior activity, and `gl`/`hl` pin the country and language
 * so a result set is not quietly shaped by the browser's own defaults.
 */
export function googleSearchUrl(query: string, canonicalName: string): string {
  const params = new URLSearchParams({
    q: query,
    uule: uuleFor(canonicalName),
    pws: '0',
    gl: 'us',
    hl: 'en',
  });
  return `https://www.google.com/search?${params.toString()}`;
}

/**
 * The line the checker should see at the bottom of the results page if it worked.
 *
 * ⚠️ VERIFYING IS STILL THE CHECKER'S JOB. A `uule` cannot fail silently the way the Sensors panel
 * did — a malformed one is ignored and the footer shows the IP city, which is visible — but "cannot
 * fail silently" is not "cannot fail". The footer is the receipt, and it takes two seconds.
 */
export function expectedFooterCity(canonicalName: string): string {
  const [city, region] = String(canonicalName).split(',');
  return [city, region].filter(Boolean).join(', ');
}
