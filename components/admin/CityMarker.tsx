// components/admin/CityMarker.tsx
import { CircleMarker, Popup } from 'react-leaflet';
import { useMemo } from 'react';
import { useRouter } from 'next/router';

interface CityMarkerProps {
  point: any;
  zoom: number;
  getColor: (point: any) => string;
  router: ReturnType<typeof useRouter>;
}

export default function CityMarker({ point, zoom, getColor, router }: CityMarkerProps) {
  const shouldRender = useMemo(() => {
    return !(zoom < 4 && (point.leads + point.domains) < 3);
  }, [zoom, point]);

  if (!shouldRender) return null;

  return (
    <CircleMarker
      center={[point.lat, point.lon]}
      radius={6 + (point.leads + point.domains) * 0.5}
      pathOptions={{ color: getColor(point), fillColor: getColor(point), fillOpacity: 0.7 }}
    >
      <Popup className="w-64 p-4 bg-gray-800 text-white rounded-lg shadow-lg">
        <div className="space-y-2">
          <div className="text-lg font-bold">{point.city}, {point.state}</div>
          <div className="text-sm">Leads: {point.leads}</div>
          {point.leadNames.length > 0 && (
            <div className="text-xs text-gray-300">{point.leadNames.join(', ')}</div>
          )}
          <div className="text-sm mt-1">Domains: {point.domains}</div>
          {point.domainNames.length > 0 && (
            <div className="text-xs text-gray-300">{point.domainNames.join(', ')}</div>
          )}
          {point.leads >= 2 && (
            <button
              onClick={() => {
                const query = new URLSearchParams({
                  city: point.city,
                  state: point.state,
                  leadIds: point.leadIds.join(',')
                });
                router.push(`/admin/start-campaign?${query}`);
              }}
              className="mt-3 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 w-full"
            >
              🚀 Start Campaign
            </button>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}
