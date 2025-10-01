'use client';

import * as React from 'react';
import type { LeafletFooterMapProps } from './leaflet-footer-map';

// Lazy import Leaflet only on client
let L: typeof import('leaflet') | null = null;
async function ensureLeaflet() {
  if (!L) {
    const mod = await import('leaflet');
    // Fix default icon URLs if you use markers and haven’t set these globally
    // (Optional; safe to remove if you already handle this elsewhere)
    (mod as any).Icon.Default.mergeOptions?.({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    L = mod;
  }
  return L!;
}

function isValidLatLng(v: any): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}

export function LeafletMapInner(props: LeafletFooterMapProps) {
  const { center, zoom = 14, height = 180, markerTitle, interactive = false } = props;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import('leaflet').Map | null>(null);
  const markerRef = React.useRef<import('leaflet').Marker | null>(null);

  // Initialize once when we have a container + valid center
  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      if (!isValidLatLng(center)) return;

      const Lx = await ensureLeaflet();
      if (cancelled) return;

      // If a map already exists on this container, remove it first
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }

      // Create map
      const map = Lx.map(containerRef.current, {
        center,
        zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        tapHold: interactive as any,
        attributionControl: false,
        preferCanvas: true,
      });

      mapRef.current = map;

      // Base tiles
      Lx.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
      }).addTo(map);

      // Marker
      try {
        const m = Lx.marker(center, { title: markerTitle ?? '', interactive });
        m.addTo(map);
        markerRef.current = m;
      } catch {
        markerRef.current = null;
      }
    }

    init();
    return () => {
      cancelled = true;
      // Cleanup completely so container can be reused without "already initialized"
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
      markerRef.current = null;
    };
    // Only run when container mounts or center first becomes valid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current, isValidLatLng(center) ? center[0] : null, isValidLatLng(center) ? center[1] : null]);

  // Respond to subsequent center/zoom changes without recreating the map
  React.useEffect(() => {
    if (!mapRef.current) return;
    if (!isValidLatLng(center)) return;
    try {
      mapRef.current.setView(center, zoom);
      if (markerRef.current) {
        markerRef.current.setLatLng(center as any);
      }
    } catch {
      // no-op: if Leaflet throws, ignore instead of crashing editor
    }
  }, [center, zoom]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height }}
      // Make it obvious that the map is decorative/non-interactive by default
      className="relative"
      aria-label={markerTitle || 'Map'}
      role="img"
    />
  );
}
