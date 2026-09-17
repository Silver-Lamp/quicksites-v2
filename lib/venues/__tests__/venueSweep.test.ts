/**
 * @jest-environment node
 */
// lib/venues/__tests__/venueSweep.test.ts — the venue-sweep contract (crosstalk/contracts/venue-sweep.md).

import { mergeVenues, parseCityRegion, clampRadius, runVenueSweep, VenueSweepError, VENUE_NOTE } from '@/lib/venues/venueSweep';
import { PlacesError } from '@/lib/places/searchNearby';

const biz = (over: Partial<any> = {}) => ({
  placeId: 'p1',
  name: 'Marine Room Tavern',
  website: 'https://marineroomtavern.com',
  phone: '(949) 494-3027',
  address: '214 Ocean Ave, Laguna Beach, CA 92651, USA',
  lat: 33.5427,
  lon: -117.7854,
  rating: 4.6,
  reviewCount: 812,
  types: ['bar', 'night_club'],
  ...over,
});

describe('parseCityRegion', () => {
  it('reads city + state from a US Places address', () => {
    expect(parseCityRegion('214 Ocean Ave, Laguna Beach, CA 92651, USA')).toEqual({ city: 'Laguna Beach', region: 'CA' });
  });
  it('is null for nothing parseable', () => {
    expect(parseCityRegion(null)).toEqual({ city: null, region: null });
    expect(parseCityRegion('Somewhere')).toEqual({ city: null, region: null });
  });
});

describe('clampRadius', () => {
  it('defaults and clamps', () => {
    expect(clampRadius(undefined)).toBe(5000);
    expect(clampRadius(10)).toBe(500);
    expect(clampRadius(999999)).toBe(50000);
    expect(clampRadius('1200')).toBe(1200);
  });
});

describe('mergeVenues', () => {
  it('dedupes by place id, keeps the text signal when both searches find a place, sorts by reviews', () => {
    const text = [biz({ matchedQuery: 'live music' }), biz({ placeId: 'p2', name: 'Sandpiper Lounge', reviewCount: 1500, matchedQuery: 'live music bar' })];
    const type = [biz({ placeId: 'p1', reviewCount: 812 }), biz({ placeId: 'p3', name: 'Quiet Bar', reviewCount: null, types: ['bar'] })];
    const v = mergeVenues(text as any, type, { city: 'Laguna Beach', region: 'CA' });
    expect(v.map((x) => x.place_id)).toEqual(['p2', 'p1', 'p3']);
    expect(v[1].signal).toBe('text');
    expect(v[2].signal).toBe('type');
    expect(v[2].review_count).toBeNull();
  });
  it('marks a type-only hit whose NAME says music as signal name', () => {
    const v = mergeVenues([], [biz({ placeId: 'p9', name: 'Blue Note Jazz Club' })], { city: null, region: null });
    expect(v[0].signal).toBe('name');
  });
  it('fills city/region from the request when the address does not parse', () => {
    const v = mergeVenues([], [biz({ address: 'Unknown' })], { city: 'Laguna Beach', region: 'CA' });
    expect(v[0]).toMatchObject({ city: 'Laguna Beach', region: 'CA' });
  });
  it('caps at the limit', () => {
    const many = Array.from({ length: 60 }, (_, i) => biz({ placeId: `p${i}`, reviewCount: i }));
    expect(mergeVenues([], many, { city: null, region: null })).toHaveLength(40);
  });
});

function deps(over: Partial<any> = {}): any {
  return {
    geocode: async () => ({ lat: 33.54, lon: -117.78 }),
    text: async () => [biz({ matchedQuery: 'live music' })],
    nearby: async () => [biz({ placeId: 'p2', name: 'The Sandpiper' })],
    ...over,
  };
}

describe('the radius is a fence, not a bias', () => {
  // Real first sweep of Laguna Beach at 5 km led with House of Blues Anaheim, ~40 km away:
  // Places text search only BIASES toward the radius. We fence on coordinates ourselves.
  it('drops a text hit far outside the radius and keeps one with no coordinates', () => {
    const center = { lat: 33.5427, lon: -117.7854, radiusMeters: 5000 };
    const anaheim = biz({ placeId: 'hob', name: 'House of Blues Anaheim', lat: 33.8089, lon: -117.919, reviewCount: 5743, matchedQuery: 'live music' });
    const local = biz({ matchedQuery: 'live music' });
    const unknown = biz({ placeId: 'u', name: 'Somewhere', lat: null, lon: null, reviewCount: 1, matchedQuery: 'live music' });
    const v = mergeVenues([anaheim, local, unknown] as any, [], { city: null, region: null }, 40, center);
    expect(v.map((x) => x.place_id)).toEqual(['p1', 'u']);
  });
});

describe('runVenueSweep', () => {
  it('geocodes a city and returns the contract shape with the honesty note', async () => {
    const r = await runVenueSweep({ city: 'Laguna Beach', region: 'CA' }, deps());
    expect(r.ok).toBe(true);
    expect(r.center).toEqual({ lat: 33.54, lon: -117.78, label: 'Laguna Beach, CA' });
    expect(r.venues).toHaveLength(2);
    expect(r.note).toBe(VENUE_NOTE);
    expect(Object.keys(r.venues[0]).sort()).toEqual(
      ['address', 'city', 'lat', 'lon', 'name', 'phone', 'place_id', 'rating', 'region', 'review_count', 'signal', 'types', 'website'].sort(),
    );
  });
  it('skips geocoding when lat/lon are given', async () => {
    const geocode = jest.fn();
    const r = await runVenueSweep({ lat: 1, lon: 2 }, deps({ geocode }));
    expect(geocode).not.toHaveBeenCalled();
    expect(r.center.label).toBe('1.0000, 2.0000');
  });
  it('400 without a city or coordinates; 400 on an unknown kind', async () => {
    await expect(runVenueSweep({}, deps())).rejects.toMatchObject({ status: 400 });
    await expect(runVenueSweep({ city: 'X', kinds: ['karaoke'] }, deps())).rejects.toMatchObject({ status: 400, code: 'bad_kind' });
  });
  it('422 when the city cannot be geocoded', async () => {
    await expect(runVenueSweep({ city: 'Nowhereville' }, deps({ geocode: async () => null }))).rejects.toMatchObject({ status: 422 });
  });
  it('501 not_configured when the Places key is absent, 502 on a Places failure', async () => {
    const off = deps({ text: async () => { throw new PlacesError('not_configured', 'no key'); } });
    await expect(runVenueSweep({ city: 'X' }, off)).rejects.toMatchObject({ status: 501, code: 'not_configured' });
    const down = deps({ nearby: async () => { throw new PlacesError('fetch_failed', 'boom'); } });
    const err = await runVenueSweep({ city: 'X' }, down).catch((e) => e);
    expect(err).toBeInstanceOf(VenueSweepError);
    expect(err.status).toBe(502);
  });
});
