// lib/parks/registry.ts
//
// Data access for the industrial-park registry (public.industrial_parks +
// public.industrial_park_sweeps). Service-role only, untyped client — same convention
// as outreach_prospects (these tables aren't in types/supabase.ts yet).
//
// The registry IS the cache: an area is swept once (recorded in industrial_park_sweeps
// even when zero parks are found), then reused for every subsequent pitch site there.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { inferParkUses, schemeForPark, type SuiteScheme, type ParkUse } from './suiteScheme';
import { areaKey } from './keys';

export { areaKey } from './keys';

/** Env flag — mirrors the geoRecsLlmEnabled() shape. Registry works independent of the LLM. */
export function parksRegistryEnabled(): boolean {
  const v = process.env.PARKS_REGISTRY_ENABLED;
  return v === '1' || v === 'true';
}

export type Park = {
  id: string;
  place_id: string;
  name: string;
  street: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  permitted_uses: ParkUse[];
  suite_scheme: SuiteScheme;
};

export type ParkInput = {
  placeId: string;
  name: string;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  matchedQuery?: string | null;
};

const PARK_COLS =
  'id, place_id, name, street, city, region, postal_code, lat, lng, permitted_uses, suite_scheme';

/** Has this area already been swept (so we can skip a Places call)? */
export async function hasAreaBeenSwept(city: string, region: string | null | undefined): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('industrial_park_sweeps')
    .select('area_key')
    .eq('area_key', areaKey(city, region))
    .maybeSingle();
  if (error) throw new Error(`hasAreaBeenSwept failed: ${error.message}`);
  return !!data;
}

/** All parks stored for an area (case-insensitive city+region match). */
export async function getParksForArea(city: string, region: string | null | undefined): Promise<Park[]> {
  let q = supabaseAdmin.from('industrial_parks').select(PARK_COLS).ilike('city', city.trim());
  const r = (region ?? '').trim();
  if (r) q = q.ilike('region', r);
  const { data, error } = await q.limit(100);
  if (error) throw new Error(`getParksForArea failed: ${error.message}`);
  return (data ?? []) as Park[];
}

/**
 * Insert discovered parks, ignoring any whose place_id already exists (on-conflict
 * do-nothing) so re-sweeping never clobbers a manually-verified park. permitted_uses +
 * suite_scheme are derived here (from the name / place_id) at write time. Returns the
 * count inserted.
 */
export async function upsertParks(rows: ParkInput[]): Promise<number> {
  if (!rows.length) return 0;
  const toRow = (p: ParkInput) => ({
    place_id: p.placeId,
    name: p.name,
    street: p.street ?? null,
    city: p.city ?? null,
    region: p.region ?? null,
    postal_code: p.postalCode ?? null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    permitted_uses: inferParkUses(p.name),
    suite_scheme: schemeForPark(p.placeId),
    matched_query: p.matchedQuery ?? null,
    source: 'google_places_text',
  });
  const { data, error } = await supabaseAdmin
    .from('industrial_parks')
    .upsert(rows.map(toRow), { onConflict: 'place_id', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`upsertParks failed: ${error.message}`);
  return data?.length ?? 0;
}

/** Record that we swept an area (even 0 parks) so ensure never re-hits Places for it. */
export async function recordAreaSweep(args: {
  city: string;
  region: string | null | undefined;
  lat?: number | null;
  lng?: number | null;
  radiusMeters?: number | null;
  parksFound: number;
  sweptBy?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('industrial_park_sweeps').upsert(
    {
      area_key: areaKey(args.city, args.region),
      city: args.city.trim(),
      region: (args.region ?? '').trim() || null,
      lat: args.lat ?? null,
      lng: args.lng ?? null,
      radius_meters: args.radiusMeters ?? null,
      parks_found: args.parksFound,
      swept_by: args.sweptBy ?? null,
      swept_at: new Date().toISOString(),
    },
    { onConflict: 'area_key' },
  );
  if (error) throw new Error(`recordAreaSweep failed: ${error.message}`);
}
