/**
 * @jest-environment node
 */
// lib/places/__tests__/searchTextNearby.test.ts
//
// Keyword sweep primitive: one Places-API-(New) searchText call per query,
// website captured from the response, results deduped by place id and tagged with
// the query that matched (so keyword categories like towing/HVAC classify right).

import { searchTextNearby } from '@/lib/places/searchTextNearby';

const OLD_ENV = process.env.GOOGLE_PLACES_API_KEY;
beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
});
afterAll(() => {
  process.env.GOOGLE_PLACES_API_KEY = OLD_ENV;
});

function jsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const PLACE = (over: Partial<any> = {}) => ({
  id: 'place_a',
  displayName: { text: "Ray's Towing" },
  websiteUri: undefined,
  nationalPhoneNumber: '253-555-0100',
  formattedAddress: '1 Main St',
  location: { latitude: 47.3, longitude: -122.2 },
  types: ['point_of_interest', 'establishment'],
  ...over,
});

describe('searchTextNearby', () => {
  it('throws not_configured when the API key is missing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(
      searchTextNearby({ lat: 47, lon: -122, radiusMeters: 1500, textQueries: ['towing service'] }),
    ).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('returns [] for no queries without calling the API', async () => {
    const fetchImpl = jest.fn();
    const out = await searchTextNearby(
      { lat: 47, lon: -122, radiusMeters: 1500, textQueries: [] },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends a textQuery + locationBias circle and captures website presence/absence', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        places: [
          PLACE({ id: 'no_site', websiteUri: undefined }),
          PLACE({ id: 'has_site', websiteUri: 'https://rays.example' }),
        ],
      }),
    );
    const out = await searchTextNearby(
      { lat: 47, lon: -122, radiusMeters: 1500, textQueries: ['towing service'] },
      fetchImpl as unknown as typeof fetch,
    );
    const sentBody = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
    expect(sentBody.textQuery).toBe('towing service');
    expect(sentBody.locationBias?.circle?.radius).toBe(1500);
    const byId = Object.fromEntries(out.map((b) => [b.placeId, b]));
    expect(byId['no_site'].website).toBeNull();
    expect(byId['has_site'].website).toBe('https://rays.example');
  });

  it('tags each result with the query that matched and dedupes across queries', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ places: [PLACE({ id: 'shared' }), PLACE({ id: 'only_tow' })] }))
      .mockResolvedValueOnce(jsonResponse({ places: [PLACE({ id: 'shared' }), PLACE({ id: 'only_hvac' })] }));
    const out = await searchTextNearby(
      { lat: 47, lon: -122, radiusMeters: 1500, textQueries: ['towing service', 'HVAC contractor'] },
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const byId = Object.fromEntries(out.map((b) => [b.placeId, b]));
    // First query to surface a place wins the dedupe (and owns its industry tag).
    expect(byId['shared'].matchedQuery).toBe('towing service');
    expect(byId['only_tow'].matchedQuery).toBe('towing service');
    expect(byId['only_hvac'].matchedQuery).toBe('HVAC contractor');
  });

  it('maps a 403 (API not enabled) to not_configured', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ error: { message: 'Places API (New) has not been used' } }, false, 403),
    );
    await expect(
      searchTextNearby(
        { lat: 47, lon: -122, radiusMeters: 1500, textQueries: ['towing service'] },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'not_configured' });
  });
});
