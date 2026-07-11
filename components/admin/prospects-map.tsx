'use client';

// components/admin/prospects-map.tsx
//
// A focused Leaflet map for the businesses-near-me sweep: one marker per prospect at
// its lat/lon, colored by lead tier (green = no website, amber = dated, grey = has a
// site). Clicking a marker toggles its selection (mirrors the table checkboxes).
// Loaded ssr:false from prospects-client. Uses react-leaflet CircleMarkers (no marker
// icon assets needed).

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { Prospect } from '@/lib/outreach/prospects';

const TIER_COLOR: Record<string, string> = {
  no_website: '#34d399', // emerald
  dated: '#fbbf24', // amber
  has_site: '#6b7280', // grey
};

type Coord = [number, number];

function hasCoords(p: Prospect): p is Prospect & { address_lat: number; address_lon: number } {
  return p.address_lat != null && p.address_lon != null;
}

function FitBounds({ coords }: { coords: Coord[] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length) map.fitBounds(coords, { padding: [30, 30], maxZoom: 14 });
  }, [coords, map]);
  return null;
}

export default function ProspectsMap({
  prospects,
  selected,
  onToggle,
}: {
  prospects: Prospect[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const pts = prospects.filter(hasCoords);
  const coords: Coord[] = pts.map((p) => [p.address_lat, p.address_lon]);
  const center: Coord = coords[0] ?? [39.8, -98.6]; // continental US fallback

  return (
    <MapContainer center={center} zoom={pts.length ? 12 : 4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds coords={coords} />
      {pts.map((p) => {
        const isSel = selected.has(p.id);
        const color = TIER_COLOR[p.lead_tier] ?? '#6b7280';
        return (
          <CircleMarker
            key={p.id}
            center={[p.address_lat, p.address_lon]}
            radius={isSel ? 9 : 6}
            pathOptions={{
              color: isSel ? '#818cf8' : color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: isSel ? 3 : 1,
            }}
            eventHandlers={{ click: () => onToggle(p.id) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <strong>{p.business_name}</strong>
                <br />
                <span>{p.address}</span>
                <br />
                <em>{p.lead_tier.replace('_', ' ')}</em>
                {p.website ? (
                  <>
                    <br />
                    <a href={p.website} target="_blank" rel="noopener noreferrer">
                      current site ↗
                    </a>
                  </>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
