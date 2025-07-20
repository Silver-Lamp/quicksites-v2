'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { useNearbyCities } from '@/hooks/useNearbyCities';
import { MapWrapper } from './map-wrapper';

export default function ServiceAreasEditor({ block, onSave, onClose, errors, template }: BlockEditorProps) {
  const content = (block as any).content ?? {};
  const [lat, setLat] = useState(content.sourceLat?.toString() || '');
  const [lng, setLng] = useState(content.sourceLng?.toString() || '');
  const [radius, setRadius] = useState(content.radiusMiles?.toString() || '30');
  const [selected, setSelected] = useState<string[]>(content.cities || []);
  const [lastFetched, setLastFetched] = useState(content.lastFetched || null);
  const [manualEntry, setManualEntry] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'alpha'>('distance');
  const [showAllPins, setShowAllPins] = useState(false);
  const { cities, loading, error, fetchCities } = useNearbyCities();

  const runFetchCities = async () => {
    const now = new Date().toISOString();
    await fetchCities(Number(lat), Number(lng), Number(radius));
    setLastFetched(now);
  };

  useEffect(() => {
    if (!Array.isArray(content.allCities) || content.allCities.length === 0) {
      console.log('[Editor] Auto-fetching cities because cache is empty.');
      runFetchCities();
    }
  }, []);

  const toggle = (city: string) => {
    setSelected((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const sortedCities = [...cities].sort((a, b) => {
    if (sortBy === 'alpha') return a.name.localeCompare(b.name);
    return a.distance - b.distance;
  });

  const save = () => {
    const included = cities.filter((c) => selected.includes(c.name));
    onSave({
      ...block,
      content: {
        ...content,
        cities: included.map(c => c.name),
        allCities: sortedCities.map(c => c.name),
        sourceLat: Number(lat),
        sourceLng: Number(lng),
        radiusMiles: Number(radius),
        lastFetched,
      },
    });
  };

  const selectedMarkers = cities.filter((c) => selected.includes(c.name));
  const unselectedMarkers = cities.filter((c) => !selected.includes(c.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start gap-4">
        <div className="flex-1 space-y-2 w-full">
          <div className="flex gap-2">
            <Input placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
            <Input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <label className="text-sm">Radius: {radius} miles</label>
          <input type="range" min="5" max="100" step="1" value={radius} onChange={(e) => setRadius(e.target.value)} />
          <Button onClick={runFetchCities} disabled={loading}>Refresh Cities</Button>
          <div className="text-sm text-neutral-400">Last fetched: {lastFetched || 'Not yet'}</div>
          <div className="flex items-center gap-4 mt-2">
            <label className="text-sm font-medium">Sort by:</label>
            <select
              className="text-sm bg-neutral-800 border rounded px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'distance' | 'alpha')}
            >
              <option value="distance">Distance</option>
              <option value="alpha">A–Z</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-sm font-medium">Show all pins:</label>
            <input type="checkbox" checked={showAllPins} onChange={() => setShowAllPins(!showAllPins)} />
          </div>
        </div>
        <div className="flex-1 w-full h-80">
          {lat && lng && (
            <MapWrapper
              lat={Number(lat)}
              lng={Number(lng)}
              selected={selectedMarkers}
              unselected={unselectedMarkers}
              showAllPins={showAllPins}
            />
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <Button size="sm" onClick={() => setSelected(sortedCities.map(c => c.name))}>Select All</Button>
        <Button size="sm" variant="outline" onClick={() => setSelected([])}>Deselect All</Button>
      </div>

      <div className="max-h-[400px] overflow-y-auto pr-2 border rounded bg-neutral-900">
  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
        {sortedCities.map((city) => (
          <label key={city.name} className="flex gap-2 items-center">
            <Checkbox checked={selected.includes(city.name)} onCheckedChange={() => toggle(city.name)} />
            {city.name} <span className="text-xs text-neutral-400">({(city.distance * 0.621371).toFixed(1)} mi)</span>
          </label>
        ))}
        </div>
</div>

      <div className="flex gap-2 mt-4">
        <Button onClick={save}>Save</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
