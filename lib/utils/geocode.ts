/** Pure: a Nominatim reverse-geocode answer → { city, region } (US state code), or null. */
export function cityStateFromNominatim(json: any): { city: string; region: string } | null {
  const a = json?.address;
  if (!a) return null;
  // A place name before a county: a point in unincorporated land has no city, and the first
  // "Sweep where I am" from such a point filed twenty restaurants under city = "King County"
  // (2026-10-11). The suburb / neighbourhood Nominatim gives is the name people use for where
  // they are; the county is the last resort, not the second.
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.neighbourhood || a.city_district || a.county || null;
  const iso = typeof a['ISO3166-2-lvl4'] === 'string' ? a['ISO3166-2-lvl4'] : '';
  const region = iso.startsWith('US-') ? iso.slice(3) : (a.state_code || '').toUpperCase();
  if (!city || !region) return null;
  return { city: String(city), region: String(region) };
}

/** Reverse: where is this point? (Nominatim; same source and user agent as the forward lookup.) */
export async function getCityStateForLatLon(lat: number, lon: number): Promise<{ city: string; region: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'QuickSites-Geocoder/1.0 (support@quicksites.ai)', Accept: 'application/json' } });
    return cityStateFromNominatim(await res.json());
  } catch (e) {
    console.warn(`🌐 Failed to reverse-geocode ${lat},${lon}`, e);
    return null;
  }
}

export async function getLatLonForCityState(
    city: string,
    state?: string
  ): Promise<{ lat: number; lon: number } | null> {
    const query = `${city}${state ? `, ${state}` : ''}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'QuickSites-Geocoder/1.0 (support@quicksites.ai)',
          'Accept': 'application/json',
        },
      });
  
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
    } catch (e) {
      console.warn(`🌐 Failed to geocode city: ${query}`, e);
    }
  
    return null;
  }
  