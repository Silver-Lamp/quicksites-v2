/**
 * @jest-environment node
 */
// A legacy prospect gets a street by NAME — and the module must refuse to guess. The rejections
// are the load-bearing part: an accepted wrong match mails a real card to a stranger's shop with
// another business's name on it.
import {
  assessAddressCandidate,
  backfillProspectAddresses,
  backfillQuery,
  isLegacyPlaceId,
  nameSimilarity,
  needsAddressBackfill,
  type BackfillCandidate,
} from '../addressBackfill';
import type { TextMatch } from '../../places/searchText';

function prospect(over: Partial<BackfillCandidate> = {}): BackfillCandidate {
  return {
    id: 'p-legacy',
    place_id: 'lead:514c256e-0000-4000-8000-000000000000',
    business_name: "Ray's Trk & Wrecker Svc Inc",
    address: 'Red Bay, AL',
    city: 'Red Bay',
    region: 'AL',
    status: 'draft_built',
    template_id: 't1',
    address_lat: 34.4409,
    address_lon: -88.1432,
    ...over,
  };
}

function match(over: Partial<TextMatch> = {}): TextMatch {
  return {
    placeId: 'ChIJrealGoogleId',
    name: "Ray's Truck & Wrecker Service",
    website: null,
    phone: null,
    address: '1200 4th Ave SE, Red Bay, AL 35582, USA',
    lat: 34.44,
    lon: -88.14,
    rating: null,
    reviewCount: null,
    ...over,
  };
}

const none = new Map<string, string>();

describe('who needs a lookup', () => {
  it('a city-only legacy row does; a row with a street does not; a demo fixture never does', () => {
    expect(isLegacyPlaceId('lead:abc')).toBe(true);
    expect(isLegacyPlaceId('ChIJx')).toBe(false);
    expect(needsAddressBackfill(prospect())).toBe(true);
    expect(needsAddressBackfill(prospect({ address: '2000 Benson Rd S #125, Renton, WA 98055, USA', place_id: 'ChIJx' }))).toBe(false);
    expect(needsAddressBackfill(prospect({ place_id: 'demo:demo-the-quiet-pearl', address: 'Marrowdale, WA' }))).toBe(false);
  });

  it('queries name, city, state — the words a person would type', () => {
    expect(backfillQuery(prospect())).toBe("Ray's Trk & Wrecker Svc Inc, Red Bay, AL");
  });
});

describe('name similarity folds the abbreviations legacy leads used', () => {
  it('Trk/Svc/Inc vs Truck/Service reads as the same shop', () => {
    expect(nameSimilarity("Ray's Trk & Wrecker Svc Inc", "Ray's Truck & Wrecker Service")).toBe(1);
  });
  it('a longer official name containing the stored one is a full match', () => {
    expect(nameSimilarity('Oakley\'s Towing', "Oakley's Towing & Recovery LLC")).toBe(1);
  });
  it('a different business in the same trade is not', () => {
    expect(nameSimilarity('JNS Towing', 'Huntsville Wrecker Service')).toBeLessThan(0.5);
  });
});

describe('assessAddressCandidate refuses to guess', () => {
  it('accepts a matching name with a street in the right city and state', () => {
    const v = assessAddressCandidate(prospect(), match(), none);
    expect(v.accept).toBe(true);
    if (v.accept) {
      expect(v.parsed).toEqual({ line1: '1200 4th Ave SE', city: 'Red Bay', state: 'AL', zip: '35582' });
      expect(v.cityDiffers).toBe(false);
    }
  });

  it('rejects no result', () => {
    expect(assessAddressCandidate(prospect(), null, none)).toMatchObject({ accept: false, reason: 'no_match' });
  });

  it('rejects a result that is itself only a town (no street number)', () => {
    expect(assessAddressCandidate(prospect(), match({ address: 'Red Bay, AL 35582, USA' }), none)).toMatchObject({ accept: false, reason: 'no_street' });
  });

  it('rejects a street in the wrong state even when the name matches', () => {
    const v = assessAddressCandidate(prospect(), match({ address: '10 Main St, Red Bay, TN 37000, USA' }), none);
    expect(v).toMatchObject({ accept: false, reason: 'state_differs' });
  });

  it('rejects a different business at a plausible address', () => {
    const v = assessAddressCandidate(prospect(), match({ name: 'Franklin County Auto Body' }), none);
    expect(v).toMatchObject({ accept: false, reason: 'name_differs' });
  });

  it('rejects a neighbouring-town result on a so-so name, accepts it (flagged) on a near-exact one', () => {
    // Vina, AL is ~15 km from Red Bay.
    const elsewhere = match({ address: '55 Depot St, Vina, AL 35593, USA', lat: 34.373, lon: -88.056 });
    // "Rays Wrecker Recovery" vs "Ray's Truck & Wrecker Service" shares 2 of 4 tokens = 0.5: passes
    // the name bar, not the city-override bar.
    const soSo = assessAddressCandidate(prospect({ business_name: 'Rays Wrecker Recovery' }), elsewhere, none);
    expect(soSo).toMatchObject({ accept: false, reason: 'city_differs' });
    const exact = assessAddressCandidate(prospect(), elsewhere, none);
    expect(exact).toMatchObject({ accept: true, cityDiffers: true, allowed: false });
    if (exact.accept) expect(exact.distanceKm).toBeGreaterThan(5);
    if (exact.accept) expect(exact.distanceKm).toBeLessThan(60);
  });

  it('⚠️ rejects an exact-name match in a different town beyond 60 km — the Grant\'s Towing case', () => {
    // Row: Grantsville (coords actually in WV). Result: Fort Mitchell, AL — same state, same name, ~800 km.
    const grants = prospect({ id: 'p-grants', business_name: "Grant's Towing Service", city: 'Grantsville', region: 'AL', address_lat: 38.9234, address_lon: -81.0959 });
    const fortMitchell = match({ placeId: 'ChIJfm', name: "Grant's Towing Service", address: '1 Clear Creek, Fort Mitchell, AL 36856, USA', lat: 32.34, lon: -84.98 });
    const v = assessAddressCandidate(grants, fortMitchell, none);
    expect(v).toMatchObject({ accept: false, reason: 'too_far' });
    if (!v.accept) expect(v.detail).toMatch(/Fort Mitchell, \d{3,4} km/);
  });

  it('a same-named town with bad row coordinates is still accepted — the distance rule only runs when the town differs', () => {
    // AT CONCRETE: row geocoded "Pacific" as Pacific County (coast), Google has the CITY of Pacific, 140 km away.
    const at = prospect({ id: 'p-at', business_name: 'AT CONCRETE LLC', city: 'Pacific', region: 'WA', address_lat: 46.533, address_lon: -123.768 });
    const city = match({ placeId: 'ChIJat', name: 'AT CONCRETE LLC', address: '738 4th Ave NE apto. 1003, Pacific, WA 98047, USA', lat: 47.264, lon: -122.25 });
    expect(assessAddressCandidate(at, city, none)).toMatchObject({ accept: true, cityDiffers: false });
  });

  it('a row with no coordinates falls back to the name rule and is flagged, not rejected', () => {
    const noCoords = prospect({ address_lat: null, address_lon: null });
    const far = match({ address: '1 Clear Creek, Fort Mitchell, AL 36856, USA', lat: 32.34, lon: -84.98 });
    expect(assessAddressCandidate(noCoords, far, none)).toMatchObject({ accept: true, cityDiffers: true, distanceKm: null });
  });

  it('--allow bypasses the distance rule for an eyeballed row, and NOTHING else', () => {
    const allow = new Set(['p-legacy']);
    const far = match({ address: '1 Clear Creek, Fort Mitchell, AL 36856, USA', lat: 32.34, lon: -84.98 });
    expect(assessAddressCandidate(prospect(), far, none, { allow })).toMatchObject({ accept: true, allowed: true });
    // Still a duplicate.
    const existing = new Map([['ChIJrealGoogleId', 'p-real-row']]);
    expect(assessAddressCandidate(prospect(), far, existing, { allow })).toMatchObject({ accept: false, reason: 'duplicate_of' });
    // Still the wrong state.
    expect(assessAddressCandidate(prospect(), match({ address: '10 Main St, Red Bay, TN 37000, USA' }), none, { allow })).toMatchObject({ accept: false, reason: 'state_differs' });
    // Still a different business.
    expect(assessAddressCandidate(prospect(), match({ name: 'Franklin County Auto Body' }), none, { allow })).toMatchObject({ accept: false, reason: 'name_differs' });
    // Still no street.
    expect(assessAddressCandidate(prospect(), match({ address: 'Holloway Rd, Lebanon, TN 37090, USA' }), none, { allow })).toMatchObject({ accept: false });
  });

  it('⚠️ refuses when another prospect already owns the returned place_id — that is a duplicate draft, not a fix', () => {
    const existing = new Map([['ChIJrealGoogleId', 'p-real-row']]);
    const v = assessAddressCandidate(prospect(), match(), existing);
    expect(v).toMatchObject({ accept: false, reason: 'duplicate_of', duplicateOf: 'p-real-row' });
  });

  it('does not treat the row itself as a duplicate', () => {
    const existing = new Map([['ChIJrealGoogleId', 'p-legacy']]);
    expect(assessAddressCandidate(prospect(), match(), existing).accept).toBe(true);
  });
});

describe('backfillProspectAddresses', () => {
  function deps(results: Record<string, TextMatch | null>, existing = none) {
    const writes: any[] = [];
    const dismissed: string[] = [];
    return {
      writes,
      dismissed,
      deps: {
        search: async (q: string) => results[q] ?? null,
        existingPlaceIds: existing,
        writeAddress: async (id: string, address: string, lat: number | null, lon: number | null) => { writes.push({ id, address, lat, lon }); },
        dismiss: async (id: string) => { dismissed.push(id); },
      },
    };
  }

  it('is dry by default: reports the accept, writes nothing', async () => {
    const d = deps({ [backfillQuery(prospect())]: match() });
    const r = await backfillProspectAddresses([prospect()], d.deps, { apply: false, dismissDuplicates: false });
    expect(r).toMatchObject({ scanned: 1, needed: 1, accepted: 1, written: 0, dismissed: 0 });
    expect(d.writes).toEqual([]);
  });

  it('writes address + coordinates on --apply, and never a place_id', async () => {
    const d = deps({ [backfillQuery(prospect())]: match() });
    const r = await backfillProspectAddresses([prospect()], d.deps, { apply: true, dismissDuplicates: false });
    expect(r.written).toBe(1);
    expect(d.writes).toEqual([{ id: 'p-legacy', address: '1200 4th Ave SE, Red Bay, AL 35582, USA', lat: 34.44, lon: -88.14 }]);
    expect(Object.keys(d.writes[0])).not.toContain('placeId');
  });

  it('skips rows that already have a street without spending a search', async () => {
    let searches = 0;
    const d = deps({});
    d.deps.search = async () => { searches++; return null; };
    const r = await backfillProspectAddresses([prospect({ address: '1 Main St, Red Bay, AL 35582, USA' })], d.deps, { apply: true, dismissDuplicates: false });
    expect(r).toMatchObject({ scanned: 1, needed: 0 });
    expect(searches).toBe(0);
  });

  it('dismisses a duplicate only when BOTH --apply and --dismiss-duplicates are set', async () => {
    const existing = new Map([['ChIJrealGoogleId', 'p-real-row']]);
    const results = { [backfillQuery(prospect())]: match() };
    const a = deps(results, existing);
    await backfillProspectAddresses([prospect()], a.deps, { apply: true, dismissDuplicates: false });
    expect(a.dismissed).toEqual([]);
    const b = deps(results, existing);
    await backfillProspectAddresses([prospect()], b.deps, { apply: false, dismissDuplicates: true });
    expect(b.dismissed).toEqual([]);
    const c = deps(results, existing);
    const r = await backfillProspectAddresses([prospect()], c.deps, { apply: true, dismissDuplicates: true });
    expect(c.dismissed).toEqual(['p-legacy']);
    expect(c.writes).toEqual([]);
    expect(r).toMatchObject({ dismissed: 1, written: 0, rejected: { duplicate_of: 1 } });
  });

  it('--skip leaves a row alone: no search, no write, not counted as needed', async () => {
    let searches = 0;
    const d = deps({});
    d.deps.search = async () => { searches++; return match(); };
    const r = await backfillProspectAddresses([prospect()], d.deps, { apply: true, dismissDuplicates: false, skip: new Set(['p-legacy']) });
    expect(r).toMatchObject({ scanned: 1, needed: 0, written: 0 });
    expect(searches).toBe(0);
  });

  it('a failing search is a rejection for that row, not a crash for the run', async () => {
    const d = deps({});
    d.deps.search = async () => { throw new Error('quota'); };
    const r = await backfillProspectAddresses([prospect()], d.deps, { apply: true, dismissDuplicates: false });
    expect(r.rows[0].verdict).toMatchObject({ accept: false, reason: 'no_match', detail: 'quota' });
    expect(d.writes).toEqual([]);
  });
});
