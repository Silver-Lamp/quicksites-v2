import { useState } from 'react';

function toTitleCase(name: string): string {
  return name.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export type CityInfo = {
  name: string;
  distance: number;
  lat: number;
  lng: number;
};

export function useNearbyCities() {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchCities = async (lat: number, lng: number, radiusMiles = 30) => {
    setLoading(true);
    setError(null);
    try {
      console.log('[useNearbyCities] Fetching nearby cities', { lat, lng, radiusMiles });

      const res = await fetch(
        `/api/nearby-cities?lat=${lat}&lng=${lng}&radius=${radiusMiles * 1609}`
      );
      const data = await res.json();
      console.log('[useNearbyCities] API response', data);

      if (res.ok) {
        const normalized: CityInfo[] = (data.cities || []).map((c: any) => ({
          name: toTitleCase(c.name),
          distance: c.distance,
          lat: c.lat,
          lng: c.lng,
        }));
        setCities(normalized);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('[useNearbyCities] Error:', err);
      setError(err.message || 'Request failed');
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  return { cities, loading, error, fetchCities };
}
