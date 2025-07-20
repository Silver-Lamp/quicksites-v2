'use client';

import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import type { CityInfo } from '@/hooks/useNearbyCities';

export function MarkerLayer({
  selected,
  unselected,
  showAllPins
}: {
  selected: CityInfo[];
  unselected: CityInfo[];
  showAllPins: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const points = selected.length ? selected : (showAllPins ? unselected : []);
    const bounds = points.map(c => [c.lat, c.lng] as [number, number]);

    if (bounds.length === 1) {
      map.setView(L.latLng(bounds[0]), 12);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    }
  }, [selected, unselected, showAllPins, map]);

  return (
    <>
      {selected.map((c) => (
        <Marker key={c.name + '-sel'} position={[c.lat, c.lng]}>
          <Popup>{c.name}</Popup>
        </Marker>
      ))}
      {showAllPins &&
        unselected.map((c) => (
          <Marker key={c.name + '-unsel'} position={[c.lat, c.lng]} opacity={0.4}>
            <Popup>{c.name} (not selected)</Popup>
          </Marker>
        ))}
    </>
  );
}
