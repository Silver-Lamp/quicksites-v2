// lib/geo/cleanCityName.ts
//
// Normalize a "city" string before it's used for a geo lookup (Google Places, the parks
// registry, etc.). Geo pitch sites often carry a *service-area* phrase instead of a bare
// city — "Serving Cambridge, MA", "Proudly serving the Renton area" — which a Places query
// can't resolve. This strips the service-area lead-in, the "…and surrounding areas" tail,
// and anything after the first comma (a state code / region), leaving just the core city.

/** Strip service-area framing so "Serving Cambridge, MA" → "Cambridge". Safe on a plain city. */
export function cleanCityName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim();
  // Everything after the first comma is a state/region tail for a city field — drop it.
  s = s.split(',')[0];
  // Leading service-area lead-in: "Serving", "Now serving", "Proudly serving (the)".
  s = s.replace(/^\s*(?:now\s+|proudly\s+)?serving\s+(?:the\s+)?/i, '');
  // Trailing area/metro descriptor: "…area", "…metro area", "…and surrounding/nearby areas".
  s = s.replace(/\s*(?:and\s+(?:the\s+)?(?:surrounding|nearby)\s+areas?|metro(?:politan)?(?:\s+area)?|area)\s*$/i, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}
