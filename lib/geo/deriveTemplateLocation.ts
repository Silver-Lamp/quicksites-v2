// lib/geo/deriveTemplateLocation.ts
//
// Best-effort city/state for a template even when the identity address fields are blank —
// from structured contact/identity, else the geo campaign's city (data.meta.geo_city) + the
// "City, ST" that appears in the generated copy ("Serving Cambridge, MA…"). Pure + shared by
// the editor's Identity panel and the server-side "fill office address" action, so both derive
// the same location. City is cleaned of service-area framing (see cleanCityName).

import { cleanCityName } from '@/lib/geo/cleanCityName';

function obj(v: any): any {
  return v && typeof v === 'object' ? v : {};
}

export function deriveTemplateLocation(t: {
  data?: any;
  city?: string | null;
  state?: string | null;
}): { city: string; state: string } {
  const data = obj(t?.data);
  const meta = obj(data.meta);
  const metaContact = obj(meta.contact);
  const metaIdentity = obj(meta.identity);
  const metaIdentityContact = obj(metaIdentity.contact);

  const structuredCity = cleanCityName(
    metaContact.city || metaIdentity.city || metaIdentityContact.city || t?.city || '',
  );
  const structuredState = String(
    metaContact.state || metaIdentity.state || metaIdentityContact.state || t?.state || '',
  ).trim();
  if (structuredCity && structuredState) return { city: structuredCity, state: structuredState };

  const city = structuredCity || cleanCityName(meta.geo_city || '');
  let state = structuredState;
  try {
    const blob = JSON.stringify(data);
    if (city && !state) {
      const esc = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const paired = blob.match(new RegExp(`${esc}\\s*,\\s*([A-Z]{2})\\b`));
      if (paired) state = paired[1];
    }
    if (!city) {
      const m = blob.match(/([A-Za-z][A-Za-z .]+?),\s*([A-Z]{2})\b/);
      if (m) return { city: cleanCityName(m[1]), state: m[2] };
    }
  } catch {}
  return { city, state };
}
