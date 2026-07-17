// lib/route/optimizeRoute.ts
//
// Route optimization borrowed VERBATIM from PorchHearth's batch-delivery seam
// (crosstalk ideas.md §19; their frontend/app/cook/batch-delivery/page.tsx). Pure,
// dependency-free, $0 — a greedy nearest-neighbor order over Haversine straight-line
// distance. Made generic so it reorders any stop object that carries lat/lon.
//
// HONEST LIMITS (label these in any UI): straight-line miles, NOT driving distance; a
// greedy heuristic, NOT optimal TSP (fine for a small daily list, degrades as N grows);
// an open route from one start point (no return-to-origin unless you append it). Real
// driving distance + time needs a routing vendor = a paid v2 PorchHearth service.

export type LatLng = { latitude: number; longitude: number };

/** Haversine great-circle distance in miles (verbatim from PorchHearth). */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Greedy nearest-neighbor order from a start point (verbatim from PorchHearth, made
 * generic). Returns the stops reordered — every field passthrough, untouched.
 */
export function optimizeRoute<T extends LatLng>(startLat: number, startLon: number, stops: T[]): T[] {
  if (stops.length === 0) return [];

  const unvisited = [...stops];
  const route: T[] = [];
  let currentLat = startLat;
  let currentLon = startLon;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(currentLat, currentLon, unvisited[0].latitude, unvisited[0].longitude);

    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(currentLat, currentLon, unvisited[i].latitude, unvisited[i].longitude);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = unvisited.splice(nearestIndex, 1)[0];
    route.push(nearest);
    currentLat = nearest.latitude;
    currentLon = nearest.longitude;
  }

  return route;
}

/** Sum straight-line miles across a start → ordered-stops path (cheap; still as-the-crow-flies). */
export function totalStraightLineMiles(startLat: number, startLon: number, ordered: LatLng[]): number {
  let total = 0;
  let cLat = startLat;
  let cLon = startLon;
  for (const s of ordered) {
    total += calculateDistance(cLat, cLon, s.latitude, s.longitude);
    cLat = s.latitude;
    cLon = s.longitude;
  }
  return total;
}
