type GeoResult = { lat: number; lon: number };
const memoryCache: Record<string, GeoResult> = {};

const getLocalStorageCache = (): Record<string, GeoResult> => {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem('geoCache');
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

const setLocalStorageCache = (cache: Record<string, GeoResult>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('geoCache', JSON.stringify(cache));
  } catch {}
};

export async function resolveGeo(city: string, state: string): Promise<GeoResult> {
  const key = `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;

  // Check in-memory cache first
  if (memoryCache[key]) return memoryCache[key];

  // Check localStorage cache
  const localCache = getLocalStorageCache();
  if (localCache[key]) {
    memoryCache[key] = localCache[key]; // hydrate into memory
    return localCache[key];
  }

  console.log('[🗺️ geoCache miss]', key);

  // Fetch from API
  try {
    const res = await fetch(`/api/geocode?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
    const json = await res.json();

    const lat = json.lat ?? 39.5;
    const lon = json.lon ?? -98.35;
    const result = { lat, lon };

    // Cache result in both memory + localStorage
    memoryCache[key] = result;
    localCache[key] = result;
    setLocalStorageCache(localCache);

    return result;
  } catch (err) {
    console.warn('[⚠️ geocode failed]', err);
    return { lat: 39.5, lon: -98.35 }; // fallback: US center
  }
}
