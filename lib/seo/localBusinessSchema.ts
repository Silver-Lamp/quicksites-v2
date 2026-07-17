// lib/seo/localBusinessSchema.ts
//
// Build LocalBusiness JSON-LD from a template's identity/contact — emitted on the public
// site (app/sites/[slug]/…) when meta.local_business_schema is enabled, and used by the
// editor's Readiness coach "Add schema" one-click action. Pure + tolerant of the several
// places identity/contact live (data.meta.contact, data.identity.contact, …). Computed live
// at render so it stays fresh as the address changes — the stored flag just turns it on.

import { resolveIndustryKey } from '@/lib/industries';

// Industry → schema.org LocalBusiness subtype (only real subtypes; everything else stays the
// generic LocalBusiness so we never emit an invalid @type).
const SCHEMA_TYPE: Record<string, string> = {
  plumbing: 'Plumber',
  hvac: 'HVACBusiness',
  electrical: 'Electrician',
  roof_cleaning: 'RoofingContractor',
  general_contractor: 'GeneralContractor',
  painting: 'HousePainter',
  moving: 'MovingCompany',
  auto_repair: 'AutoRepair',
  towing: 'AutoRepair',
  legal: 'Attorney',
  real_estate: 'RealEstateAgent',
  restaurant: 'Restaurant',
  salon_spa: 'HealthAndBeautyBusiness',
  fitness: 'ExerciseGym',
  medical_dental: 'Dentist',
};

function firstStr(...vals: any[]): string {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}
function numOrNull(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function obj(v: any): any {
  return v && typeof v === 'object' ? v : {};
}

const SCHEMA_DAY: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

/** First hours block on the site (canonical blocks, legacy content_blocks fallback). */
function findHoursContent(d: any): any | null {
  const pages: any[] = Array.isArray(d?.pages) ? d.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks) ? p.blocks : Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    const hit = blocks.find((b: any) => b?.type === 'hours' && b?.content);
    if (hit) return hit.content;
  }
  return null;
}

/**
 * openingHoursSpecification from the site's hours block — a signal Google actually
 * consumes for local results (unlike, say, self-serving review markup). One spec per
 * open period; alwaysOpen collapses to a single all-week 00:00–23:59 entry.
 */
function openingHoursFrom(hours: any): Array<Record<string, any>> {
  if (!hours) return [];
  if (hours.alwaysOpen === true) {
    return [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: Object.values(SCHEMA_DAY),
      opens: '00:00',
      closes: '23:59',
    }];
  }
  const out: Array<Record<string, any>> = [];
  const days: any[] = Array.isArray(hours.days) ? hours.days : [];
  for (const day of days) {
    if (!day || day.closed === true) continue;
    const dow = SCHEMA_DAY[String(day.key)];
    if (!dow) continue;
    const periods: any[] = Array.isArray(day.periods) ? day.periods : [];
    for (const p of periods) {
      if (typeof p?.open === 'string' && typeof p?.close === 'string') {
        out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: dow, opens: p.open, closes: p.close });
      }
    }
  }
  return out;
}

/** Is LocalBusiness schema turned on for this site? (Matches onPage.hasLocalBusinessSchema.) */
export function localBusinessSchemaEnabled(data: any): boolean {
  const m = obj(data?.meta);
  return !!(m.local_business_schema || obj(m.schema).localBusiness || m.jsonld);
}

/**
 * Build a LocalBusiness JSON-LD object from a template's `data`, or null when there isn't
 * enough to be meaningful (needs a name + a city or street address). `opts.url` sets the
 * canonical url.
 */
export function buildLocalBusinessSchema(data: any, opts?: { url?: string }): Record<string, any> | null {
  const d = obj(data);
  const meta = obj(d.meta);
  const metaContact = obj(meta.contact);
  const identity = obj(d.identity);
  const idContact = obj(identity.contact);
  const metaIdentity = obj(meta.identity);
  const metaIdContact = obj(metaIdentity.contact);

  const name = firstStr(
    identity.business_name, meta.business, metaIdentity.business_name,
    d.business_name, meta.siteTitle, identity.template_name,
  );
  const city = firstStr(metaContact.city, idContact.city, metaIdContact.city, meta.geo_city);
  const streetAddress = firstStr(metaContact.address, idContact.address, metaIdContact.address);
  // Not enough for a credible LocalBusiness entry — let the caller emit nothing.
  if (!name || (!city && !streetAddress)) return null;

  const phone = firstStr(metaContact.phone, idContact.phone, metaIdContact.phone);
  const region = firstStr(metaContact.state, idContact.state, metaIdContact.state);
  const postal = firstStr(metaContact.postal, idContact.postal, metaIdContact.postal);
  const lat = numOrNull(metaContact.latitude ?? idContact.latitude ?? metaIdContact.latitude);
  const lng = numOrNull(metaContact.longitude ?? idContact.longitude ?? metaIdContact.longitude);
  const industryKey = resolveIndustryKey(firstStr(identity.industry, meta.industry, metaIdentity.industry));

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[industryKey] ?? 'LocalBusiness',
    name,
  };
  const url = firstStr(opts?.url, meta.canonical_url);
  if (url) schema.url = url;
  if (phone) schema.telephone = phone;

  const address: Record<string, any> = { '@type': 'PostalAddress', addressCountry: 'US' };
  if (streetAddress) address.streetAddress = streetAddress;
  if (city) address.addressLocality = city;
  if (region) address.addressRegion = region;
  if (postal) address.postalCode = postal;
  schema.address = address;

  if (lat != null && lng != null) schema.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  if (city) schema.areaServed = region ? `${city}, ${region}` : city;
  const desc = firstStr(meta.description, d.description);
  if (desc) schema.description = desc;

  // Opening hours ride along whenever the site has an hours block — stays live
  // because the whole schema is rebuilt from data at render time.
  const opening = openingHoursFrom(findHoursContent(d));
  if (opening.length) schema.openingHoursSpecification = opening;

  return schema;
}
