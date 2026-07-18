// lib/rebuild/parseAddress.ts
//
// Pure address helpers (NO imports) shared by the rebuild/import pipeline. Kept in their own
// module so callers (importListing, assembleDraft) can value-import them WITHOUT dragging in
// inferSiteSpec's heavy transitive imports (the AI meter → supabase client) — which otherwise
// breaks jest module loading. Fixes "addresses not parsing into location fields": a full
// formatted address used to be dumped into a single field instead of split into city/state/postal.

/**
 * Split a Google/Places-style formatted address into structured parts. Handles the common US
 * shape "907 S 3rd St, Renton, WA 98057, USA"; degrades gracefully — returns just `address`
 * (the whole string) when it can't confidently split (foreign / comma-less / too few parts), so
 * nothing is ever mangled.
 */
export function parseUsAddress(raw: string): {
  address: string;
  address2?: string;
  city?: string;
  state?: string;
  postal?: string;
} {
  const full = String(raw ?? '').trim();
  const parts = full
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 3) return { address: full }; // not enough structure to trust a split

  // Drop a trailing country token.
  if (/^(usa|us|u\.s\.a?\.?|united states)$/i.test(parts[parts.length - 1])) parts.pop();

  let state: string | undefined;
  let postal: string | undefined;
  const stateZip = parts[parts.length - 1]?.match(/^([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/);
  if (stateZip) {
    state = stateZip[1].toUpperCase();
    postal = stateZip[2];
    parts.pop();
  }

  // Need at least street + city left, and a state/postal, to call it parsed; else keep whole.
  if (parts.length < 2 || (!state && !postal)) return { address: full };

  const city = parts.pop();
  const address = parts.join(', ');
  return { address: address || full, city: city || undefined, state, postal };
}

/** Reconstruct a single-line address from structured parts (for map queries + display). */
export function formatContactAddress(c: {
  address?: string;
  city?: string;
  state?: string;
  postal?: string;
}): string {
  const tail = [c.city, [c.state, c.postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [c.address, tail].filter(Boolean).join(', ');
}
