import fetch from 'node-fetch';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeCityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\w/g, (c) => c.toUpperCase());
}

export async function getNearbyCities(lat: number, lng: number, radiusMeters = 48280): Promise<
  { name: string; distance: number; lat: number; lng: number }[]
> {
  const query = `
    [out:json][timeout:25];
    (
      node[place~"city|town|village"](around:${radiusMeters},${lat},${lng});
    );
    out body;
  `;
  const url = 'https://overpass-api.de/api/interpreter';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`
  });

  const data = await res.json() as { elements: { tags: { name: string }; lat: number; lon: number }[] };
  if (!data.elements) return [];

  const seen = new Set();
  const enriched = data.elements
    .filter((e: any) => e.tags?.name && e.lat && e.lon)
    .map((e: any) => {
      const norm = normalizeCityName(e.tags.name);
      return {
        name: norm,
        lat: e.lat,
        lng: e.lon,
        distance: haversineDistance(lat, lng, e.lat, e.lon),
      };
    })
    .filter(e => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });

  enriched.sort((a, b) => a.distance - b.distance);
  return enriched;
}
