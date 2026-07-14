// lib/parks/keys.ts
//
// Pure string helpers for the parks registry — no I/O, no supabase import — so they're
// unit-testable without loading the service-role client.

/** Normalized coverage key for an area, e.g. "renton|wa". Stable + case-insensitive. */
export function areaKey(city: string, region: string | null | undefined): string {
  return `${city.trim().toLowerCase()}|${(region ?? '').trim().toLowerCase()}`;
}

/** Best-effort split of a Places formatted address ("123 Way, Renton, WA 98057, USA"). */
export function splitFormatted(addr: string | null | undefined): {
  street: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
} {
  if (!addr) return { street: null, city: null, region: null, postalCode: null };
  const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length && /^(usa|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  const street = parts[0] ?? null;
  const city = parts.length >= 2 ? parts[1] : null;
  let region: string | null = null;
  let postalCode: string | null = null;
  const last = parts[parts.length - 1];
  if (parts.length >= 3 && last) {
    const m = last.match(/^([A-Za-z]{2})\b\s*(\d{5})?/);
    if (m) {
      region = m[1].toUpperCase();
      postalCode = m[2] ?? null;
    }
  }
  return { street, city, region, postalCode };
}
