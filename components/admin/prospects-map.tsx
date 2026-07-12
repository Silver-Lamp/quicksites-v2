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
import { MapContainer, TileLayer, CircleMarker, Rectangle, Popup, useMap } from 'react-leaflet';
import type { Prospect } from '@/lib/outreach/prospects';
import type { TerritoryScore } from '@/lib/prospects/territoryScore';
import { formatCents } from '@/lib/outreach/geoPricing';

const TIER_COLOR: Record<string, string> = {
  no_website: '#34d399', // emerald
  dated: '#fbbf24', // amber
  has_site: '#6b7280', // grey
};

type Coord = [number, number];

function hasCoords(p: Prospect): p is Prospect & { address_lat: number; address_lon: number } {
  return p.address_lat != null && p.address_lon != null;
}

/** A grid cell key ("lat,lon" centroid) → the leaflet rectangle bounds for that cell. */
function cellBounds(cell: string, cellDegrees: number): [Coord, Coord] | null {
  const [lat, lon] = cell.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null; // non-grid keyer (e.g. city)
  const d = cellDegrees / 2;
  return [[lat - d, lon - d], [lat + d, lon + d]];
}

/** Violet heat: hotter (higher score) cells read stronger. Distinct from the tier markers. */
function scoreFill(score: number): number {
  return 0.12 + 0.5 * (Math.max(0, Math.min(100, score)) / 100);
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
  territories,
  cellDegrees = 0.02,
}: {
  prospects: Prospect[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** When set, draw a scored "where to target next" heat overlay under the markers. */
  territories?: TerritoryScore[];
  /** Grid cell size in degrees (must match the scorer's cellDegrees). */
  cellDegrees?: number;
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
      {/* Territory heat overlay — rendered first so prospect markers stay clickable on top. */}
      {(territories ?? []).map((t) => {
        const bounds = cellBounds(t.cell, cellDegrees);
        if (!bounds) return null;
        return (
          <Rectangle
            key={`terr-${t.cell}`}
            bounds={bounds}
            pathOptions={{ color: '#a855f7', weight: 1, fillColor: '#a855f7', fillOpacity: scoreFill(t.score) }}
          >
            <Popup>
              <div style={{ minWidth: 190 }}>
                <strong>Territory score: {t.score}/100</strong>
                <br />
                <span>{formatCents(t.estMonthlyRentCents)}/mo unlockable · {t.viableCards} competition card{t.viableCards === 1 ? '' : 's'}</span>
                <br />
                <span>{t.rationale.noWebsite} no-website · {t.rationale.dated} dated · {t.count} total</span>
                {t.rationale.topIndustry ? (
                  <>
                    <br />
                    <em>top: {t.rationale.topIndustry.replace(/_/g, ' ')}</em>
                  </>
                ) : null}
              </div>
            </Popup>
          </Rectangle>
        );
      })}
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
