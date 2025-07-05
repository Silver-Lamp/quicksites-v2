export async function geocodeCity(
    city: string,
    state?: string
  ): Promise<{ lat: number; lon: number } | null> {
    const query = `${city}${state ? `, ${state}` : ''}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  
    const res = await fetch(url);
    const data = await res.json();
  
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
  
    return null;
  }
  