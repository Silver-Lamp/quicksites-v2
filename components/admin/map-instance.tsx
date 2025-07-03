'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CityMarker from './city-marker';

export default function MapInstance({ points, zoom, setZoom, router, getColor, filteredPoints }: { points: any[], zoom: number, setZoom: (z: number) => void, router: any, getColor: (p: any) => string, filteredPoints: any[] }) {
  const mapRef = useRef<L.Map>(null);

  useEffect(() => {
    // 🧼 Remove any previously mounted map
    const existingMap = document.getElementById('map-root');
    if (existingMap && (existingMap as any)._leaflet_id) {
      try {
        (existingMap as any)._leaflet_id = null;
      } catch (err) {
        console.warn('[⚠️ cleanup failed]', err);
      }
    }
  }, []);

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
      whenReady={() => {
        const map = mapRef.current;
        if (map) {
          map.on('zoomend', () => setZoom(map.getZoom()));
        }
      }}
      ref={mapRef}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      {filteredPoints.map((p, i) => (
        <CityMarker key={i} point={p} zoom={zoom} router={router} getColor={getColor} />
      ))}
    </MapContainer>
  );
}
