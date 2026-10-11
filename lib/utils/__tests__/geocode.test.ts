import { cityStateFromNominatim } from '@/lib/utils/geocode';

describe('cityStateFromNominatim — a place name before a county', () => {
  it('reads a city and the US state code', () => {
    expect(cityStateFromNominatim({ address: { city: 'Renton', 'ISO3166-2-lvl4': 'US-WA' } })).toEqual({ city: 'Renton', region: 'WA' });
  });
  it('in unincorporated land, prefers the suburb / neighbourhood over the county (the "King County" sweep)', () => {
    expect(cityStateFromNominatim({ address: { suburb: 'Fairwood', county: 'King County', 'ISO3166-2-lvl4': 'US-WA' } })).toEqual({ city: 'Fairwood', region: 'WA' });
    expect(cityStateFromNominatim({ address: { neighbourhood: 'East Renton Highlands', county: 'King County', state_code: 'wa' } })).toEqual({ city: 'East Renton Highlands', region: 'WA' });
  });
  it('falls back to the county only when nothing smaller is named', () => {
    expect(cityStateFromNominatim({ address: { county: 'King County', 'ISO3166-2-lvl4': 'US-WA' } })).toEqual({ city: 'King County', region: 'WA' });
    expect(cityStateFromNominatim({ address: { city: 'Vashon' } })).toBeNull();
  });
});
