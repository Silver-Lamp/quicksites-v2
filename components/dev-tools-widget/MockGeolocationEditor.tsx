// components/dev-tools-widget/MockGeolocationEditor.tsx
'use client';

import { useEffect } from 'react';
import { getLatLonFromQuery } from '@/lib/utils/location';
import { SectionToggle } from './SectionToggle';

export function MockGeolocationEditor({
  cookieValue,
  onChange,
  onDelete,
  locationQuery,
  setLocationQuery,
  loading,
  setLoading,
  activeGeo,
  collapsedByDefault = false,
}: {
  cookieValue: string;
  onChange: (key: string, value: string) => void;
  onDelete: () => void;
  locationQuery: string;
  setLocationQuery: (v: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  activeGeo: { lat?: string; lon?: string };
  collapsedByDefault?: boolean;
}) {
  useEffect(() => {
    if (!locationQuery) return;
    const delay = setTimeout(async () => {
      setLoading(true);
      const result = await getLatLonFromQuery(locationQuery);
      if (result) {
        onChange('mock-geo', `${result.lat},${result.lon}`);
        setLocationQuery('');
      }
      setLoading(false);
    }, 1000);
    return () => clearTimeout(delay);
  }, [locationQuery]);

  return (
    <SectionToggle title="📍 Mock Geolocation" collapsedByDefault={collapsedByDefault}>
      <div className="space-y-2">
        <input
          className="w-full px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-600"
          type="text"
          placeholder="Enter city, state..."
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
        />

        {cookieValue && (
          <div className="text-zinc-400 text-xs">
            Current: <code className="text-white font-mono">{cookieValue}</code>{' '}
            <button
              onClick={onDelete}
              className="text-red-400 hover:underline ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {activeGeo.lat && activeGeo.lon && (
          <div className="text-xs text-emerald-400">
            Navigator: {activeGeo.lat}, {activeGeo.lon}
          </div>
        )}

        {loading && <div className="text-xs text-zinc-500">Searching...</div>}
      </div>
    </SectionToggle>
  );
}
