// components/admin/safe-leaflet-map.tsx
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

export default function SafeLeafletMap({ points, zoom, setZoom, router, getColor }: Props) {
  const [mapVisible, setMapVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);

  useEffect(() => {
    if (!mapVisible || !mountRef.current || rootRef.current) return;
  
    rootRef.current = ReactDOM.createRoot(mountRef.current);
    rootRef.current.render(
      <MapView
        points={points}
        zoom={zoom}
        setZoom={setZoom}
        router={router}
        getColor={getColor}
        mapRef={mapRef}
        hoveredPointId={null}
      />
    );
  }, [mapVisible]);
  

  useEffect(() => {
    setHydrated(true);
  }, []);

  const stats = points.reduce(
    (acc, p) => {
      if (p.has2PlusUnclaimedInSameIndustry) acc.red++;
      else if (p.leadsQty >= 2 && p.domains > 0) acc.green++;
      else if (p.leadsQty >= 2) acc.orange++;
      else if (p.domains > 0) acc.blue++;
      else if (p.leadsQty > 0) acc.yellow++;
      return acc;
    },
    { yellow: 0, orange: 0, blue: 0, green: 0, red: 0 }
  );

  const monthlyValue = points.reduce((sum, p) => {
    if (p.has2PlusUnclaimedInSameIndustry) sum += 49;
    return sum;
  }, 0);

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

      {/* Always show legend when map is visible and hydrated */}
      {mapVisible && hydrated && (
        <div className="absolute bottom-4 left-4 text-sm text-white bg-black/60 p-2 rounded shadow z-[1000]">
          <div className="flex gap-2 items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" /> {stats.yellow}
            <div className="w-3 h-3 bg-orange-500 rounded-full" /> {stats.orange}
            <div className="w-3 h-3 bg-blue-500 rounded-full" /> {stats.blue}
            <div className="w-3 h-3 bg-green-500 rounded-full" /> {stats.green}
            <div className="w-3 h-3 bg-red-600 rounded-full" /> {stats.red}
          </div>
          <div className="mt-1 text-lime-300">💰 ${monthlyValue.toFixed(2)} / month</div>
        </div>
      )}
    </div>
  );
}
