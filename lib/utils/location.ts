// lib/utils/location.ts

export async function getLatLonFromQuery(query: string): Promise<{ lat: number; lon: number } | null> {
    if (!query.trim()) return null;
  
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
      const data = await response.json();
  
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.warn('[🌐 Geolocation API Error]', error);
    }
  
    return null;
  }
  