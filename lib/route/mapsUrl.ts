// lib/route/mapsUrl.ts
//
// Build a Google Maps turn-by-turn directions URL from an ordered set of stops.
// Pure + dependency-free so BOTH the server route (app/api/tools/route-optimize) and
// the client planner (live recompute when a walker hand-reorders the result) share one
// source of truth. Uses the documented Maps URLs `dir` schema (api=1), driving mode.
//
// Google caps the classic directions URL at ~9 intermediate waypoints; past that the
// link silently drops the overflow. We keep origin + destination and as many waypoints
// as fit, so the handoff never 400s — see MAX_WAYPOINTS.

export type Point = { latitude: number; longitude: number };

// Origin + destination are always sent; only the middle stops are "waypoints".
export const MAX_WAYPOINTS = 9;

const pt = (r: Point) => `${r.latitude},${r.longitude}`;

/**
 * @param ordered  the stops to visit, in order, AFTER the start (may include a
 *                 round-trip return-to-start appended as the last element)
 * @param start    the origin point
 */
export function buildMapsDirUrl(ordered: Point[], start: Point): string {
  const origin = pt(start);
  const dest = ordered.length ? pt(ordered[ordered.length - 1]) : origin;
  const mids = ordered.slice(0, -1);
  const waypoints = mids.slice(0, MAX_WAYPOINTS).map(pt).join('|');

  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', origin);
  u.searchParams.set('destination', dest);
  if (waypoints) u.searchParams.set('waypoints', waypoints);
  u.searchParams.set('travelmode', 'driving');
  return u.toString();
}

/** Single-stop directions link — "navigate to just this stop" from a walker's phone. */
export function buildSingleStopUrl(stop: Point): string {
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('destination', pt(stop));
  u.searchParams.set('travelmode', 'driving');
  return u.toString();
}
