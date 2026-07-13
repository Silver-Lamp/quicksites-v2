// lib/prospects/ownedDomains.ts
//
// Dedupe the domain buy-list against inventory the operator already owns (e.g. a Namecheap
// export they paste in). Matches two ways:
//   - exact:   same normalized domain (gallatin-towing.com == gallatin-towing.com)
//   - similar: same label ignoring hyphens / TLD (gallatin-towing.com ≈ gallatintowing.com
//              ≈ gallatintowing.net) — because a geo-domain owned without the dash is the
//              same asset, no need to re-buy.
// Pure + no I/O (matching is against the pasted list, not a registrar). See
// docs/DOMAIN_ACQUISITION_PLAN.md.

export type OwnedMatch = 'exact' | 'similar' | null;

/** Strip protocol / www / path / trailing dots and lowercase. '' if not domain-ish. */
export function normalizeDomain(input: string): string {
  let s = (input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0].split('#')[0]; // drop any path/query
  s = s.replace(/\.+$/, '').trim();
  // must contain at least one letter (avoid capturing stray tokens like prices)
  if (!/[a-z]/.test(s)) return '';
  return s;
}

/**
 * Hyphen/TLD-insensitive key for the registrable label. Takes the first label (SLD),
 * removes every non-alphanumeric char. gallatin-towing.com → "gallatintowing";
 * gallatintowing → "gallatintowing".
 */
export function domainLabelKey(input: string): string {
  const norm = normalizeDomain(input);
  if (!norm) return '';
  const label = norm.includes('.') ? norm.split('.')[0] : norm;
  return label.replace(/[^a-z0-9]/g, '');
}

/** Parse a pasted blob (newlines / commas / whitespace separated) into unique domains. */
export function parseOwnedDomains(text: string): string[] {
  const seen = new Set<string>();
  for (const tok of (text || '').split(/[\s,;]+/)) {
    const d = normalizeDomain(tok);
    if (d) seen.add(d);
  }
  return [...seen];
}

export type OwnedIndex = {
  /** Normalized full domains (for exact match). */
  full: Set<string>;
  /** Hyphen/TLD-insensitive label keys (for similar match). */
  labels: Set<string>;
  count: number;
};

/** Build a lookup index from a list (or pasted blob) of owned domains. */
export function buildOwnedIndex(owned: string[] | string): OwnedIndex {
  const list = Array.isArray(owned) ? owned : parseOwnedDomains(owned);
  const full = new Set<string>();
  const labels = new Set<string>();
  for (const d of list) {
    const norm = normalizeDomain(d);
    if (!norm) continue;
    full.add(norm);
    const key = domainLabelKey(norm);
    if (key) labels.add(key);
  }
  return { full, labels, count: full.size };
}

/** Classify a candidate domain against the owned index. */
export function matchOwned(candidateDomain: string, index: OwnedIndex): OwnedMatch {
  const norm = normalizeDomain(candidateDomain);
  if (!norm) return null;
  if (index.full.has(norm)) return 'exact';
  const key = domainLabelKey(norm);
  if (key && index.labels.has(key)) return 'similar';
  return null;
}
