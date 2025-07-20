'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MarkerLayer } from './marker-layer';
import type { CityInfo } from '@/hooks/useNearbyCities';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

export function MapWrapper({
  lat,
  lng,
  selected,
  unselected,
  showAllPins
}: {
  lat: number;
  lng: number;
  selected: CityInfo[];
  unselected: CityInfo[];
  showAllPins: boolean;
}) {
  const mapContainerId = 'service-areas-map';

  useEffect(() => {
    const container = document.getElementById(mapContainerId);
    if (container && (container as any)._leaflet_id) {
      (container as any)._leaflet_id = null; // 💥 forcibly clear container state
    }
  }, []);

  return (
    <MapContainer
      id={mapContainerId}
      center={[lat, lng]}
      zoom={10}
      scrollWheelZoom={false}
      className="w-full h-full rounded z-0"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MarkerLayer selected={selected} unselected={unselected} showAllPins={showAllPins} />
    </MapContainer>
  );
}
