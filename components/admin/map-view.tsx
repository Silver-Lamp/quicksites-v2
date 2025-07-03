'use client';

import { useEffect } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet'; // ✅ Full import for runtime value use
import type { CityPoint } from '@/types/grid';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type LMap from 'leaflet'; // Optional: still use type import for mapRef
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

function MapEvents({
  setZoom,
  mapRef,
  points,
}: {
  setZoom: (z: number) => void;
  mapRef: React.MutableRefObject<LMap.Map | null>;
  points: CityPoint[];
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    setZoom(map.getZoom());

    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);

    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, setZoom, mapRef]);

  useEffect(() => {
    const validCoords = points
      .filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number')
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);

  return null;
}

export default function MapView({
  points,
  zoom,
  setZoom,
  router,
  getColor,
  mapRef,
}: {
  points: CityPoint[];
  zoom: number;
  setZoom: (z: number) => void;
  router: AppRouterInstance;
  getColor: (p: CityPoint) => string;
  mapRef: React.MutableRefObject<LMap.Map | null>;
}) {
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={zoom}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      key={Date.now()}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapEvents setZoom={setZoom} mapRef={mapRef} points={points} />

      <MarkerClusterGroup>
        {points.map((p, i) =>
          typeof p.lat === 'number' && typeof p.lon === 'number' ? (
            <Marker
              key={`${p.city}-${p.state}-${i}`}
              position={[p.lat, p.lon]}
              eventHandlers={{
                click: () =>
                  router.push(
                    `/admin/city/${p.city.toLowerCase()}-${p.state.toLowerCase()}`
                  ),
              }}
            >
              <Tooltip>
                <div>
                  <strong>
                    {p.city}, {p.state}
                  </strong>
                  <div>{p.leads} lead(s), {p.domains} domain(s)</div>
                  <div>Industry: {p.industry || 'N/A'}</div>
                </div>
              </Tooltip>
            </Marker>
          ) : null
        )}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
