// lib/route/__tests__/mapsUrl.test.ts
//
// The Maps directions URL builder shared by the route-optimize API + the client planner.
// Locks the `dir` schema, the origin/destination split, and the waypoint cap.

import { buildMapsDirUrl, buildSingleStopUrl, MAX_WAYPOINTS } from '@/lib/route/mapsUrl';

const p = (latitude: number, longitude: number) => ({ latitude, longitude });

describe('buildMapsDirUrl', () => {
  it('sets origin = start, destination = last stop, middle stops as waypoints', () => {
    const url = new URL(buildMapsDirUrl([p(1, 1), p(2, 2), p(3, 3)], p(0, 0)));
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('0,0');
    expect(url.searchParams.get('destination')).toBe('3,3');
    expect(url.searchParams.get('waypoints')).toBe('1,1|2,2');
    expect(url.searchParams.get('travelmode')).toBe('driving');
  });

  it('emits no waypoints param for a single stop', () => {
    const url = new URL(buildMapsDirUrl([p(1, 1)], p(0, 0)));
    expect(url.searchParams.get('origin')).toBe('0,0');
    expect(url.searchParams.get('destination')).toBe('1,1');
    expect(url.searchParams.get('waypoints')).toBeNull();
  });

  it('caps waypoints at MAX_WAYPOINTS so an over-long route never 400s', () => {
    const stops = Array.from({ length: 15 }, (_, i) => p(i + 1, i + 1)); // 14 middles + dest
    const url = new URL(buildMapsDirUrl(stops, p(0, 0)));
    expect(url.searchParams.get('waypoints')!.split('|')).toHaveLength(MAX_WAYPOINTS);
    expect(url.searchParams.get('destination')).toBe('15,15');
  });

  it('falls back to origin as destination when there are no stops', () => {
    const url = new URL(buildMapsDirUrl([], p(4, 5)));
    expect(url.searchParams.get('origin')).toBe('4,5');
    expect(url.searchParams.get('destination')).toBe('4,5');
  });
});

describe('buildSingleStopUrl', () => {
  it('routes to just the one destination in driving mode', () => {
    const url = new URL(buildSingleStopUrl(p(9, 9)));
    expect(url.searchParams.get('destination')).toBe('9,9');
    expect(url.searchParams.get('travelmode')).toBe('driving');
    expect(url.searchParams.get('origin')).toBeNull();
  });
});
