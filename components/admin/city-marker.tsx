// components/admin/city-marker.tsx

'use client';

import { CircleMarker, Popup } from 'react-leaflet';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface CityMarkerProps {
  point: {
    lat: number;
    lon: number;
    city: string;
    state: string;
    leads: number;
    leadNames: string[];
    leadIds: string[];
    domains: number;
    domainNames: string[];
    industry?: string;
  };
  zoom: number;
  getColor: (point: any) => string;
  router: ReturnType<typeof useRouter>;
  onClick?: () => void;
}

export default function CityMarker({
  point,
  zoom,
  getColor,
  router,
  onClick,
}: CityMarkerProps) {
  const shouldRender = useMemo(() => {
    return !(zoom < 4 && point.leads + point.domains < 3);
  }, [zoom, point]);

  if (!shouldRender) return null;

  return (
    <CircleMarker
      center={[point.lat, point.lon]}
      radius={6 + (point.leads + point.domains) * 0.5}
      pathOptions={{
        color: getColor(point),
        fillColor: getColor(point),
        fillOpacity: 0.7,
      }}
      eventHandlers={{
        click: () => onClick?.(),
      }}
    >
      <Popup className="w-64 p-4 bg-gray-800 text-white rounded-lg shadow-lg">
        <div className="space-y-2">
          <div className="text-lg font-bold">
            <div className="flex justify-between">
              {point.city}, {point.state}
            </div>
            <div className="flex justify-between">
              {point.leads} leads, {point.domains} domains
            </div>
          </div>
          <div className="text-sm">Leads: {point.leads}</div>
          {point.leadNames.length > 0 && (
            <div className="text-xs text-gray-300">
              {point.leadNames.join(', ')}
            </div>
          )}
          <div className="text-sm mt-1">Domains: {point.domains}</div>
          {point.domainNames.length > 0 && (
            <div className="text-xs text-gray-300">
              {point.domainNames.join(', ')}
            </div>
          )}
          {point.industry && (
            <div className="text-xs text-amber-300 italic">
              {point.industry}
            </div>
          )}

          {point.leads >= 0 && (
            <>
            <button
              onClick={() => {
                const query = new URLSearchParams({
                  city: point.city,
                  state: point.state,
                  leadIds: point.leadIds.join(','),
                  industry: point.industry || '',
                });
                router.push(`/admin/start-campaign?${query}`);
              }}
              className="mt-3 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 w-full"
              >
                🚀 Start Campaignz
              </button>
            </>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}
