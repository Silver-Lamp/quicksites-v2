// app/api/tools/route-optimize/route.ts
//
// The route planner behind the tasker "plan my store walk" tool (crosstalk ideas.md §19)
// — the headline use is a walker doing several AisleAsk store-cataloging stops in a day.
// Takes stops as addresses (or coords), geocodes the addresses (free Nominatim), runs
// PorchHearth's borrowed nearest-neighbor optimizer, and returns the walk order + total
// straight-line miles + a Google Maps directions link for turn-by-turn.
//
// Public + per-IP rate-limited; free (no vendor cost — Nominatim). Straight-line distance
// (honest: not driving miles). Driving distance/time is a paid PorchHearth v2.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { geocodeAddress } from '@/lib/route/geocodeAddress';
import { optimizeRoute, totalStraightLineMiles } from '@/lib/route/optimizeRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // sequential geocoding of up to 20 stops

const MAX_STOPS = 20;
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');
const numOr = (v: any): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

type InStop = { label?: string; address?: string; latitude?: number; longitude?: number };
type Resolved = { label: string; address: string; latitude: number; longitude: number };

/** Resolve a stop to coords: prefer provided lat/lon, else geocode its address. */
async function resolve(stop: InStop): Promise<Resolved | null> {
  const lat = numOr(stop.latitude);
  const lon = numOr(stop.longitude);
  const label = s(stop.label) || s(stop.address) || 'Stop';
  if (lat != null && lon != null) return { label, address: s(stop.address), latitude: lat, longitude: lon };
  const addr = s(stop.address);
  if (!addr) return null;
  const g = await geocodeAddress(addr);
  return g ? { label, address: addr, latitude: g.latitude, longitude: g.longitude } : null;
}

function mapsDirUrl(ordered: Resolved[], start: Resolved): string {
  const pt = (r: { latitude: number; longitude: number }) => `${r.latitude},${r.longitude}`;
  const origin = pt(start);
  const dest = ordered.length ? pt(ordered[ordered.length - 1]) : origin;
  const waypoints = ordered.slice(0, -1).map(pt).join('|');
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', origin);
  u.searchParams.set('destination', dest);
  if (waypoints) u.searchParams.set('waypoints', waypoints);
  u.searchParams.set('travelmode', 'driving');
  return u.toString();
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'route-optimize', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const rawStops: InStop[] = (Array.isArray(body?.stops) ? body.stops : []).slice(0, MAX_STOPS);
  const roundTrip = body?.round_trip === true;
  if (rawStops.length === 0) return NextResponse.json({ error: 'Add at least one stop.' }, { status: 400 });

  // Resolve stops (geocode as needed). Track which couldn't be located.
  const resolvedStops: Resolved[] = [];
  const unresolved: string[] = [];
  for (const st of rawStops) {
    const r = await resolve(st);
    if (r) resolvedStops.push(r);
    else unresolved.push(s(st.label) || s(st.address) || 'a stop');
  }
  if (resolvedStops.length === 0) {
    return NextResponse.json({ error: 'Couldn’t locate any of those addresses.', unresolved }, { status: 422 });
  }

  // Start: explicit start, else the first resolved stop becomes the origin.
  let start: Resolved;
  let toOrder: Resolved[];
  const rawStart: InStop | null = body?.start && (s(body.start.address) || numOr(body.start.latitude) != null) ? body.start : null;
  if (rawStart) {
    const r = await resolve(rawStart);
    if (!r) return NextResponse.json({ error: 'Couldn’t locate the starting point.', unresolved }, { status: 422 });
    start = r;
    toOrder = resolvedStops;
  } else {
    start = resolvedStops[0];
    toOrder = resolvedStops.slice(1);
  }

  let ordered = optimizeRoute(start.latitude, start.longitude, toOrder);
  if (roundTrip) ordered = [...ordered, start];
  const miles = totalStraightLineMiles(start.latitude, start.longitude, ordered);

  return NextResponse.json({
    start: { label: start.label, address: start.address, latitude: start.latitude, longitude: start.longitude },
    ordered: ordered.map((r) => ({ label: r.label, address: r.address, latitude: r.latitude, longitude: r.longitude })),
    total_miles: Math.round(miles * 10) / 10,
    maps_url: mapsDirUrl(ordered, start),
    unresolved,
    note: 'Straight-line order; distance is as-the-crow-flies, not driving miles.',
  });
}
