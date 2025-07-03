'use client';

import { MapContainer, TileLayer } from 'react-leaflet';

export default function OnlyMap() {
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      key={Date.now()}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    </MapContainer>
  );
}
