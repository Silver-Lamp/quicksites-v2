'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { CityPoint } from '@/types/grid';
import type LMap from 'leaflet';

type MapEventsProps = {
  mapRef: React.MutableRefObject<LMap.Map | null>;
  points: CityPoint[];
  setZoom: (z: number) => void;
};

export function MapEvents({ mapRef, points, setZoom }: MapEventsProps) {
  const map = useMap();
  const hasFitRef = useRef(false); // ✅ prevents repeat fitBounds

  // ✅ Assign mapRef without returning anything
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  // ✅ Zoom tracking + cleanup
  useEffect(() => {
    setZoom(map.getZoom());

    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, setZoom]);

  // ✅ Fit map once after mount
  useEffect(() => {
    if (hasFitRef.current || !map) return;

    const validCoords = points
      .filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number')
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    console.log('[MapEvents] Fitting bounds on', validCoords.length, 'points');

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([39.5, -98.35], 4); // fallback
    }

    hasFitRef.current = true; // 🔒 lock it
  }, [map, points]);

  return null;
}
