// components/admin/map-view.tsx
'use client';

import { useEffect } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  Popup,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import type { CityPoint } from '@/types/grid';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type LMap from 'leaflet';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

function getIndustryIcon(industry?: string): string {
  const key = (industry || '').toLowerCase();
  if (key.includes('tow')) return '🚛';
  if (key.includes('concrete')) return '🏗️';
  if (key.includes('roof')) return '🧱';
  if (key.includes('plumb')) return '🚽';
  if (key.includes('lawn') || key.includes('landscap')) return '🌱';
  return '🧰';
}

function getBorderColorClass(p: CityPoint): string {
  if (p.leadsQty >= 2 && p.domains > 0) return 'border-green-500';
  if (p.leadsQty >= 2) return 'border-orange-500';
  if (p.domains > 0) return 'border-blue-500';
  if (p.leadsQty > 0) return 'border-yellow-400';
  return 'border-gray-400';
}

function getPointKey(p: CityPoint): string {
  return `${p.city}${p.state}`;
}

function MapEvents({
  setZoom,
  mapRef,
  points,
  hoveredPointId,
}: {
  setZoom: (z: number) => void;
  mapRef: React.MutableRefObject<LMap.Map | null>;
  points: CityPoint[];
  hoveredPointId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  useEffect(() => {
    setZoom(map.getZoom());

    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    // return () => map.off('zoomend', onZoom);
  }, [map, setZoom]);

  useEffect(() => {
    const coords = points
      .filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number')
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);

  useEffect(() => {
    if (!hoveredPointId) return;
    const match = points.find((p) => getPointKey(p) === hoveredPointId);
    if (match?.lat && match.lon) {
      map.flyTo([match.lat, match.lon], Math.max(map.getZoom(), 10));
    }
  }, [hoveredPointId, points, map]);

  return null;
}

export default function MapView({
  points,
  zoom,
  setZoom,
  router,
  getColor,
  mapRef,
  hoveredPointId,
}: {
  points: CityPoint[];
  zoom: number;
  setZoom: (z: number) => void;
  router: AppRouterInstance;
  getColor: (p: CityPoint) => string;
  mapRef: React.MutableRefObject<LMap.Map | null>;
  hoveredPointId: string | null;
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

      <MapEvents
        setZoom={setZoom}
        mapRef={mapRef}
        points={points}
        hoveredPointId={hoveredPointId}
      />

      <MarkerClusterGroup
        iconCreateFunction={(cluster: any) => {
          const markers = cluster.getAllChildMarkers();
          const counts: Record<string, number> = {};

          markers.forEach((marker: any) => {
            const emoji = marker.getElement()?.innerText || '🧰';
            counts[emoji] = (counts[emoji] || 0) + 1;
          });

          const summary = Object.entries(counts)
            .map(([emoji, count]) => `${emoji}x${count}`)
            .join(' ');

          return L.divIcon({
            html: `<div class="emoji-cluster">${summary}</div>`,
            className: '',
            iconSize: [40, 40],
          });
        }}
      >
        {points.map((p, i) =>
          typeof p.lat === 'number' && typeof p.lon === 'number' ? (
            <Marker
              key={`${getPointKey(p)}-${i}`}
              position={[p.lat, p.lon]}
              icon={L.divIcon({
                className: '',
                html: `<div class="emoji-marker ${getBorderColorClass(p)} ${
                  getPointKey(p) === hoveredPointId ? 'glow' : ''
                }">${getIndustryIcon(p.industry)}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30],
              })}
            >
                <Popup>
                <div className="space-y-1 text-sm text-black">
                    <strong>
                    {getIndustryIcon(p.industry)} {p.city}, {p.state}
                    </strong>
                    {Array.isArray(p.leads) && p.leads.length > 0 && (
                      <div className="mt-1 text-xs text-zinc-300">
                        Leads:
                        <div className="text-zinc-500 text-[10px] font-medium mb-1">🔵 Assigned</div>
                        <ul className="list-disc list-inside">
                          {p.leads.filter((l) => l.isClaimed).map((l) => (
                            <li key={l.id}>
                              <a
                                href={`/admin/leads/${l.id}`}
                                className="text-blue-500 underline"
                                title="Assigned to campaign"
                              >
                                {l.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                        {p.leads.some((l) => !l.isClaimed) && (
                          <>
                            <div className="text-zinc-500 text-[10px] font-medium mt-2">🟡 Unclaimed</div>
                            <ul className="list-disc list-inside">
                              {p.leads.filter((l) => !l.isClaimed).map((l) => (
                                <li key={l.id}>
                                  <a
                                    href={`/admin/leads/${l.id}`}
                                    className="text-yellow-600 font-semibold underline"
                                    title="Not part of any campaign yet"
                                  >
                                    {l.name} 🟡
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}

                    <div>
                      {p.leadsQty} lead(s), {p.domains} domain(s)
                      {typeof p.unclaimedLeadCount === 'number' && (
                        <div>🟡 {p.unclaimedLeadCount} unclaimed</div>
                      )}
                      {Array.isArray(p.campaigns) && p.campaigns.length > 0 && (
                        <div>
                          📋 {p.campaigns.length} campaign(s):
                          <ul className="list-disc list-inside text-xs mt-1">
                      {p.campaigns.map((c, i) => (
                        <li key={i}>
                          <a
                            href={`/admin/campaigns?highlight=${encodeURIComponent(c)}`}
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            {c}
                          </a>
                        </li>
                      ))}
                    </ul>
                        </div>
                      )}
                    </div>
                    <div>{p.industry || 'Industry N/A'}</div>

                    {p.leadsQty >= 2 && (
                    <button
                        className="mt-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const query = new URLSearchParams({
                            city: p.city,
                            state: p.state,
                            industry: p.industry || '',
                            leadIds: (p.leadIds || []).join(','),
                        });
                        router.push(`/admin/start-campaign?${query}`);
                        }}
                    >
                        🚀 Start Campaign
                    </button>
                    )}
                </div>
                </Popup>
            </Marker>
          ) : null
        )}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
