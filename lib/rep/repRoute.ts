// lib/rep/repRoute.ts
//
// "Plan today's stops" for a rep (owner, 2026-10-13: PorchHearth's efficient-routing engine,
// which QuickSites already runs behind /tools/route-planner and POST /api/tools/route-optimize
// — crosstalk/contracts/route-optimize.md — "to plan multiple restaurant stops for efficiency;
// Daniel could co-manage it with his reps"). Pure: the restaurants worth walking into today →
// the deep link the planner already accepts (`?stops=a|b|c`, the same shape lib/walker/gigs.ts
// hands a tasker). Coordinates when the sweep stored them (no geocode), else the address.
import type { RestaurantTableRow } from '@/components/for-rep/restaurant-table';

/** The planner's own ceiling (route-optimize.md: ≤ 20 stops). */
export const ROUTE_MAX_STOPS = 20;

/** Groups a rep actually visits; "leave alone" and "site only" are not a lunch. */
const WALK_IN_GROUPS = new Set<RestaurantTableRow['group']>(['call', 'shop', 'thirdParty']);

export function routableStops(rows: readonly RestaurantTableRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (!WALK_IN_GROUPS.has(r.group)) continue;
    const name = (r.businessName ?? '').replace(/[|@]/g, ' ').trim();
    if (!name) continue;
    if (Number.isFinite(r.lat) && Number.isFinite(r.lon)) out.push(`${name} @${r.lat},${r.lon}`);
    else if (r.address?.trim()) out.push(`${name}, ${r.address.replace(/\|/g, ' ').trim()}`);
    if (out.length >= ROUTE_MAX_STOPS) break;
  }
  return out;
}

/** The planner link, or null when fewer than two stops can be placed (nothing to order). */
export function restaurantsRouteUrl(rows: readonly RestaurantTableRow[]): string | null {
  const stops = routableStops(rows);
  if (stops.length < 2) return null;
  return `/tools/route-planner?stops=${encodeURIComponent(stops.join('|'))}`;
}
