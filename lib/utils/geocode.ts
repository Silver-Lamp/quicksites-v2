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
  