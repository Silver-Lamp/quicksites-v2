'use client';

import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import dynamic from 'next/dynamic';
import type { CityPoint } from '@/types/grid';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type L from 'leaflet';

// Lazy load the map view to avoid SSR + hydration conflicts
const MapView = dynamic(() => import('./map-view'), { ssr: false });

type Props = {
  points: CityPoint[];
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  router: AppRouterInstance;
  getColor: (p: CityPoint) => string;
};

export default function SafeLeafletMap({
  points,
  zoom,
  setZoom,
  router,
  getColor,
}: Props) {
  const [mapVisible, setMapVisible] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Mount the map into the DOM only after the button is clicked
  useEffect(() => {
    if (!mapVisible || !mountRef.current) return;

    const root = ReactDOM.createRoot(mountRef.current);
    root.render(
      <MapView
        points={points}
        zoom={zoom}
        setZoom={setZoom}
        router={router}
        getColor={getColor}
        mapRef={mapRef}
      />
    );
  }, [mapVisible]);

  // Fix tiles not showing properly due to late container visibility
  useEffect(() => {
    if (!mapVisible) return;

    const timeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [mapVisible]);

  return (
    <div className="relative h-full w-full">
      {!mapVisible && (
        <button
          className="absolute z-10 left-4 top-4 px-4 py-2 bg-blue-600 text-white rounded shadow"
          onClick={() => setMapVisible(true)}
        >
          Load Map
        </button>
      )}
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
