// lib/resolveGeo.ts
import staticGeo from '@/public/staticGeo.json';
import { getCachedGeo, setCachedGeo } from './geoCache';

function getStaticFallback(city: string, state: string) {
  const key = `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;
  return staticGeo[key as keyof typeof staticGeo];
}

export async function resolveGeo(city: string, state: string): Promise<{ lat: number; lon: number }> {
  const mem = getCachedGeo(city, state);
  if (mem) return mem;

  const fallback = getStaticFallback(city, state);
  if (fallback) {
    setCachedGeo(city, state, fallback.lat, fallback.lon);
    return fallback;
  }

  const res = await fetch(`/api/geocode?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
  if (!res.ok) return { lat: 0, lon: 0 };

  const data = await res.json();
  setCachedGeo(city, state, data.lat, data.lon);
  return { lat: data.lat, lon: data.lon };
}
