// hooks/useGeoLocation.ts
import { useEffect, useState } from 'react';
import { getCachedGeo, setCachedGeo } from '../lib/geoCache.js';
import staticGeo from '../public/staticGeo.json';

// USAGE:
// const { lat, lon, loading, error } = useGeoLocation('Franklin', 'WI');
// if (loading) return <p>Loading map...</p>;
// if (error) return <p>Error: {error}</p>;

function getStaticFallback(
  city: string,
  state: string
): { lat: number; lon: number } | undefined {
  const key = `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;
  return staticGeo[key as keyof typeof staticGeo];
}

export function useGeoLocation(city: string, state: string) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!city || !state) return;

    const tryGeoSources = async () => {
      setLoading(true);
      const key = `${city}, ${state}`;

      // 1. Local memory cache
      const memoryHit = getCachedGeo(city, state);
      if (memoryHit) {
        setCoords(memoryHit);
        setLoading(false);
        return;
      }

      // 2. Static fallback JSON
      const staticHit = getStaticFallback(city, state);
      if (staticHit) {
        setCachedGeo(city, state, staticHit.lat, staticHit.lon);
        setCoords(staticHit);
        setLoading(false);
        return;
      }

      // 3. Remote API
      try {
        const res = await fetch(
          `/api/geocode?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`
        );
        if (!res.ok) throw new Error(`API failed: ${res.status}`);
        const data = await res.json();
        const lat = Number(data.lat || 0);
        const lon = Number(data.lon || 0);
        setCachedGeo(city, state, lat, lon);
        setCoords({ lat, lon });
      } catch (err: any) {
        setError(err.message || 'Unknown error');
        setCoords({ lat: 0, lon: 0 });
      } finally {
        setLoading(false);
      }
    };

    tryGeoSources();
  }, [city, state]);

  return { lat: coords?.lat, lon: coords?.lon, loading, error };
}
