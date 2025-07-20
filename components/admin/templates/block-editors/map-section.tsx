'use client';

import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type City = {
  name: string;
  lat: number;
  lng: number;
};

function FitBounds({ markers }: { markers: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = markers.length === 1
        ? L.latLng(markers[0])
        : L.latLngBounds(markers);
      map.fitBounds(bounds as any, { padding: [30, 30] });
    }
  }, [markers, map]);
  return null;
}

export function MapSection({
  lat,
  lng,
  selectedMarkers,
  unselectedMarkers,
  showAllPins
}: {
  lat: number;
  lng: number;
  selectedMarkers: City[];
  unselectedMarkers: City[];
  showAllPins: boolean;
}) {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove(); // 💥 Explicit unmount
      }
    };
  }, []);

  const center = [lat, lng] as [number, number];
  const bounds = selectedMarkers.map(c => [c.lat, c.lng] as [number, number]);

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={10}
      scrollWheelZoom={false}
      className="w-full h-full rounded z-0"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds markers={bounds.length ? bounds : [center]} />
      {selectedMarkers.map((city, i) => (
        <Marker key={city.name + '-selected'} position={[city.lat, city.lng]}>
          <Popup>{city.name}</Popup>
        </Marker>
      ))}
      {showAllPins &&
        unselectedMarkers.map((city, i) => (
          <Marker
            key={city.name + '-unselected'}
            position={[city.lat, city.lng]}
            opacity={0.4}
          >
            <Popup>{city.name} (not selected)</Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
