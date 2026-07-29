// lib/menu/looseMatch.ts
//
// "Nobody serves it" vs "nobody serves it UNDER THAT NAME."
//
// The finder matches with a plain substring test, so a search for `pad thai` misses a kitchen
// that wrote *Phad Thai*, and `bulgogi` misses *Bul Go Gi*. With human-written menu text —
// OCR'd off a photograph, half of it transliterated — naming variance is the NORMAL state of
// the data, not an edge case.
//
// ⚠️ WHY THIS IS A MEASUREMENT FIX AND NOT A SEARCH FEATURE. Those misses land in the
// zero-result bucket, which is the number that would justify building a whole cooking surface.
// A matching failure counted as unmet demand is evidence for the WRONG remedy: the dish is on
// a menu we already hold, and the fix is a synonym layer, not a recipe. (PorchHearth's catch —
// the fourth conflation found in this bucket today, after leak-vs-remedy and closed-vs-unserved.
// Each one was a bucket quietly averaging two different facts.)
//
// Deliberately NOT a fuzzy-search library. This runs per keystroke in the browser over one
// city's dishes, and it only ever decides a fallback message and a log field. Cheap, pure,
// and readable beats clever.

/** Words that carry no signal in a dish name — dropped before matching. */
const STOP = new Set(['the', 'a', 'an', 'and', 'with', 'of', 'in', 'or', 'style']);

export function tokenize(s: string): string[] {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // "bul-go-gi" and "bul go gi" should agree
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

/**
 * Levenshtein distance, capped — we only ever ask "is it ≤ max", so bail early rather than
 * compute a full matrix for words that are obviously unrelated.
 */
export function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false; // no cell in this row can lead anywhere within budget
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Is `short` obtainable from `long` by deleting exactly one character? */
function isOneInsertion(short: string, long: string): boolean {
  if (long.length - short.length !== 1) return false;
  let i = 0;
  for (let j = 0; j < long.length && i < short.length; j++) if (short[i] === long[j]) i++;
  return i === short.length;
}

/** Do the tokens differ only by swapping one ADJACENT pair? (banh / bahn) */
function isTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return (
    diff.length === 2 &&
    diff[1] === diff[0] + 1 &&
    a[diff[0]] === b[diff[1]] &&
    a[diff[1]] === b[diff[0]]
  );
}

/**
 * Does one token plausibly mean the other?
 *
 * ⚠️ THE RULE IS ABOUT THE KIND OF DIFFERENCE, NOT THE LENGTH. A first draft matched short
 * tokens exactly — reasoning that at three characters edit-distance 1 makes "cat" match "bat"
 * — and it rejected `pad` → `phad`, which is the single most common example of the exact
 * problem this file exists to solve. Length was the wrong axis:
 *
 *   - An INSERTION/DELETION of one letter, or one ADJACENT SWAP, is what transliteration and
 *     typing actually do. phad/pad, bahn/banh, noodle/noodles. Safe at any length — neither
 *     can turn a word into an unrelated one.
 *   - A SUBSTITUTION at three characters is usually a DIFFERENT WORD — cat/bat, pho/phu.
 *     Allowed only from four characters up.
 *
 * Erring toward "genuinely unserved" remains the conservative direction: a false "it's only a
 * naming problem" would reclassify real unmet demand as a spelling bug and hide the signal
 * we're trying to measure.
 */
export function tokensAgree(a: string, b: string): boolean {
  if (a === b) return true;
  // Prefix covers pluralisation and truncation ("noodle" / "noodles"), but only once both
  // tokens are long enough that a shared prefix means something.
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  // One inserted/deleted letter, or one adjacent swap — what transliteration and typing
  // actually do (phad/pad, bahn/banh). Safe at any length; neither can turn a word into an
  // unrelated one the way a substitution can.
  if (a.length < b.length ? isOneInsertion(a, b) : isOneInsertion(b, a)) return true;
  if (isTransposition(a, b)) return true;
  // Substitutions only once the word is long enough for one to not change its meaning.
  if (a.length < 4 || b.length < 4) return false;
  return editDistanceWithin(a, b, 1);
}

/**
 * True when every word of the query has a plausible counterpart in the text.
 *
 * AND across query tokens, matching `narrow`'s semantics: someone who typed two words meant
 * both. Loosening the SPELLING is not licence to loosen the LOGIC.
 */
export function looseMatch(query: string, haystack: string): boolean {
  const q = tokenize(query);
  if (!q.length) return false;
  const h = tokenize(haystack);
  if (!h.length) return false;
  return q.every((qt) => h.some((ht) => tokensAgree(qt, ht)));
}
