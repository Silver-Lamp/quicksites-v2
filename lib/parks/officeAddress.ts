// lib/parks/officeAddress.ts
//
// Resolve a geo pitch-site's default office address from the industrial-park registry: a
// REAL park building (street/city/region/zip from Google Places) + a SYNTHETIC suite
// sampled deterministically from the site's domain. This is tried before the LLM suggester
// in lib/outreach/domainOfficeAddress.ts — a real building beats a hallucinated one, and
// the fictional suite guarantees it's not a real tenant's unit.

import { ensureParksForArea } from './seedParks';
import { pickSuite, type ParkUse } from './suiteScheme';
import type { Park } from './registry';

/** Shape shared with lib/outreach/domainOfficeAddress.ts's OfficeAddress (source widened). */
export type RegistryOfficeAddress = {
  line1: string;
  suite: string;
  city: string;
  region: string;
  postalCode: string;
  /** Park coordinates (approximate), for the identity lat/lng fields. */
  lat: number | null;
  lng: number | null;
  label: string;
  source: 'registry';
  placeId: string;
  parkName: string;
};

function hashStr(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Soft preference: which park uses best fit a trade. Never a hard filter (any park works). */
function preferredUses(industryKey: string | null): ParkUse[] {
  const k = (industryKey ?? '').toLowerCase();
  if (/office|account|legal|insur|real.?estate|consult|market/.test(k)) return ['office', 'flex'];
  if (/warehouse|logistic|storage|moving|freight/.test(k)) return ['warehouse', 'flex'];
  return ['light_mfg', 'flex', 'warehouse']; // plumbing/HVAC/towing/electrical/…
}

/** Deterministically choose one park: prefer a use-matching park, tie-broken by domain. */
function choosePark(parks: Park[], industryKey: string | null, seed: string): Park {
  const want = preferredUses(industryKey);
  const matches = parks.filter((p) => p.permitted_uses.some((u) => want.includes(u)));
  const pool = matches.length ? matches : parks;
  return pool[hashStr(seed) % pool.length];
}

function formatLabel(a: { line1: string; suite: string; city: string; region: string; postalCode: string }): string {
  const hasSuiteInLine = /\b(suite|ste|unit|bldg|#)\b/i.test(a.line1);
  const street = a.suite && !hasSuiteInLine ? `${a.line1}, Suite ${a.suite}` : a.line1;
  const tail = [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, tail].filter(Boolean).join(', ');
}

/**
 * Resolve a grounded office address from the registry, lazily seeding the area from Places
 * on first touch. Returns null when the flag is off, the area has no parks, or inputs are
 * missing — the caller then falls through to the LLM/deterministic suggester.
 */
export async function resolveOfficeAddressFromRegistry(
  input: { domain: string; city: string | null; region: string | null; industryKey: string | null },
  userId: string | null = null,
): Promise<RegistryOfficeAddress | null> {
  const city = (input.city ?? '').trim();
  if (!city) return null;
  const region = (input.region ?? '').trim();

  const parks = await ensureParksForArea(city, region, userId);
  if (!parks.length) return null;

  const park = choosePark(parks, input.industryKey, input.domain);
  const line1 = (park.street ?? park.name ?? '').trim();
  if (!line1) return null;

  const suite = pickSuite(park.suite_scheme, input.domain);
  const outCity = (park.city ?? city).trim();
  const outRegion = (park.region ?? region).trim();
  const postalCode = (park.postal_code ?? '').trim();
  const label = formatLabel({ line1, suite, city: outCity, region: outRegion, postalCode });

  return {
    line1,
    suite,
    city: outCity,
    region: outRegion,
    postalCode,
    lat: park.lat,
    lng: park.lng,
    label,
    source: 'registry',
    placeId: park.place_id,
    parkName: park.name,
  };
}
