// hooks/useMockGeolocation.ts
'use client';

import { useEffect, useState } from 'react';

export function useMockGeolocation() {
  const [mockGeo, setMockGeo] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('mock-geo='));

    if (!cookie) {
      setMockGeo(null);
      return;
    }

    try {
      const value = decodeURIComponent(cookie.split('=')[1]);
      const [lat, lon] = value.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        setMockGeo({ lat, lon });
      }
    } catch {
      setMockGeo(null);
    }
  }, []);

  return mockGeo;
}
