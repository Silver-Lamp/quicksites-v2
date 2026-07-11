/**
 * @jest-environment node
 */
// lib/places/__tests__/searchNearby.test.ts
//
// The geographic fan-out primitive: one Places-API-(New) searchNearby call per
// included type, website captured from the response, results deduped by place id.

import { searchNearby, PlacesError, type NearbyBusiness } from '@/lib/places/searchNearby';

const OLD_ENV = process.env.GOOGLE_PLACES_API_KEY;
beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
});
afterAll(() => {
  process.env.GOOGLE_PLACES_API_KEY = OLD_ENV;
});

function jsonResponse(body: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const PLACE = (over: Partial<any> = {}) => ({
  id: 'place_a',
  displayName: { text: 'Joe Pizza' },
  websiteUri: undefined,
  nationalPhoneNumber: '253-555-0100',
  formattedAddress: '1 Main St',
  location: { latitude: 47.3, longitude: -122.2 },
  types: ['restaurant', 'point_of_interest'],
  ...over,
});

describe('searchNearby', () => {
  it('throws not_configured when the API key is missing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(
      searchNearby({ lat: 47, lon: -122, radiusMeters: 1500, includedTypes: ['restaurant'] }),
    ).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('captures website presence AND absence from the search response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        places: [
          PLACE({ id: 'no_site', websiteUri: undefined }),
          PLACE({ id: 'has_site', websiteUri: 'https://joes.example' }),
        ],
      }),
    );
    const out = await searchNearby(
      { lat: 47, lon: -122, radiusMeters: 1500, includedTypes: ['restaurant'] },
      fetchImpl as unknown as typeof fetch,
    );
    const byId = Object.fromEntries(out.map((b: NearbyBusiness) => [b.placeId, b]));
    expect(byId['no_site'].website).toBeNull();
    expect(byId['has_site'].website).toBe('https://joes.example');
  });

  it('issues one request per type and dedupes by place id', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ places: [PLACE({ id: 'shared' }), PLACE({ id: 'only_a' })] }))
      .mockResolvedValueOnce(jsonResponse({ places: [PLACE({ id: 'shared' }), PLACE({ id: 'only_b' })] }));
    const out = await searchNearby(
      { lat: 47, lon: -122, radiusMeters: 1500, includedTypes: ['restaurant', 'bar'] },
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.map((b) => b.placeId).sort()).toEqual(['only_a', 'only_b', 'shared']);
  });

  it('maps a 403 (API not enabled) to not_configured', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'Places API (New) has not been used' } }, false, 403));
    await expect(
      searchNearby(
        { lat: 47, lon: -122, radiusMeters: 1500, includedTypes: ['restaurant'] },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('requires at least one category', async () => {
    await expect(
      searchNearby({ lat: 47, lon: -122, radiusMeters: 1500, includedTypes: [] }),
    ).rejects.toBeInstanceOf(PlacesError);
  });
});
