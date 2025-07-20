'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { useNearbyCities } from '@/hooks/useNearbyCities';

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function ServiceAreasEditor({ block, onSave, onClose, errors, template }: BlockEditorProps) {
  const content = (block as any).content ?? {};

  const [lat, setLat] = useState(content.sourceLat?.toString() || '');
  const [lng, setLng] = useState(content.sourceLng?.toString() || '');
  const [radius, setRadius] = useState(content.radiusMiles?.toString() || '30');
  const [selected, setSelected] = useState<string[]>(content.cities || []);
  const [lastFetched, setLastFetched] = useState(content.lastFetched || null);
  const [manualMode, setManualMode] = useState(false);
  const [manualEntry, setManualEntry] = useState('');
  const { cities, loading, error, fetchCities } = useNearbyCities();

  // Load cached city list from block
  useEffect(() => {
    if (Array.isArray(content.allCities) && content.allCities.length > 0) {
      console.log('[Editor] Restoring cached cities from block content.');
      fetchCities(Number(lat), Number(lng), Number(radius)); // optional: refresh silently
    }
  }, []);

  // Escape to close
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  const runFetchCities = async () => {
    const now = new Date().toISOString();
    await fetchCities(Number(lat), Number(lng), Number(radius));
    setLastFetched(now);
    setSelected((prev) => prev.length > 0 ? prev : cities.slice(0, 10));
  };

  const handleGeocode = async () => {
    const result = await geocodeAddress(manualEntry);
    if (result) {
      setLat(result.lat.toString());
      setLng(result.lng.toString());
    }
  };

  const toggle = (city: string) => {
    setSelected((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const save = () => {
    const included = cities.filter((city) => selected.includes(city));
    onSave({
      ...block,
      content: {
        lastFetched,
        ...content,
        cities: included,
        allCities: cities,
        sourceLat: Number(lat),
        sourceLng: Number(lng),
        radiusMiles: Number(radius),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Manual Mode:</label>
        <input type="checkbox" checked={manualMode} onChange={() => setManualMode(!manualMode)} />
      </div>

      {manualMode ? (
        <div className="space-y-2">
          <Input
            placeholder="Add city name manually"
            value={manualEntry}
            onChange={(e) => setManualEntry(e.target.value)}
          />
          <Button onClick={() => {
            if (manualEntry && !selected.includes(manualEntry)) {
              setSelected([...selected, manualEntry]);
              setManualEntry('');
            }
          }}>Add City</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
              <Input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
            <Input
              placeholder="Or type full address"
              value={manualEntry}
              onChange={(e) => setManualEntry(e.target.value)}
            />
            <Button onClick={handleGeocode}>Geocode Address</Button>

            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">
              Radius: {radius} miles
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full"
            />
          </div>

          <Button onClick={runFetchCities} disabled={loading}>Refresh Cities</Button>
          <div className="text-sm mt-2 text-neutral-400">Last fetched: {lastFetched || "Not yet"}</div>
          <Button onClick={runFetchCities} disabled={loading}>
            {loading ? 'Fetching...' : 'Fetch Cities'}
          </Button>

          <div className="h-64 w-full mt-4 border rounded overflow-hidden">
            {lat && lng && (
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng)-0.5}%2C${Number(lat)-0.5}%2C${Number(lng)+0.5}%2C${Number(lat)+0.5}&layer=mapnik&marker=${lat}%2C${lng}`}
              />
            )}
          </div>

          <div className="text-sm mt-2">
            <span className="font-medium">Cities found:</span> {cities.length}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {cities.map((city) => (
          <label key={city} className="flex gap-2 items-center">
            <Checkbox checked={selected.includes(city)} onCheckedChange={() => toggle(city)} />
            {city}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={save}>Save</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
