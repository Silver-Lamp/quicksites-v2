// components/admin/templates/block-editors/service-areas-editor.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { useNearbyCities } from '@/hooks/useNearbyCities';
import { MapWrapper } from './map-wrapper';
import type { Template } from '@/types/template';

type GeoHit = {
  display_name: string;
  lat: string;
  lon: string;
};

export default function ServiceAreasEditor({
  block,
  onSave,
  onClose,
  template, // ✅ use DB defaults
}: BlockEditorProps & { template: Template }) {
  const content = (block as any).content ?? {};

  // --- DB identity defaults ---
  const db = (template as any) || {};
  const dbLat =
    typeof db.latitude === 'number'
      ? db.latitude
      : db.latitude != null
      ? Number(db.latitude)
      : null;
  const dbLng =
    typeof db.longitude === 'number'
      ? db.longitude
      : db.longitude != null
      ? Number(db.longitude)
      : null;

  const dbCity = (db.city ?? '').toString().trim();
  const dbState = (db.state ?? '').toString().trim();
  const dbAddr1 = (db.address_line1 ?? '').toString().trim();

  // Build a sensible default place query from DB address
  const dbPlaceQuery = [dbAddr1, [dbCity, dbState].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(', ')
    .trim();

  // --- Editor state (prefer block content; else DB defaults) ---
  const [lat, setLat] = useState<string>(() =>
    content.sourceLat != null && content.sourceLat !== ''
      ? String(content.sourceLat)
      : dbLat != null && Number.isFinite(dbLat)
      ? String(dbLat)
      : ''
  );
  const [lng, setLng] = useState<string>(() =>
    content.sourceLng != null && content.sourceLng !== ''
      ? String(content.sourceLng)
      : dbLng != null && Number.isFinite(dbLng)
      ? String(dbLng)
      : ''
  );
  const [radius, setRadius] = useState(content.radiusMiles?.toString() || '30');
  const [selected, setSelected] = useState<string[]>(content.cities || []);
  const [lastFetched, setLastFetched] = useState<string | null>(content.lastFetched || null);
  const [sortBy, setSortBy] = useState<'distance' | 'alpha'>('distance');
  const [showAllPins, setShowAllPins] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  // NEW: place lookup
  const [placeQuery, setPlaceQuery] = useState<string>(() =>
    content.placeQuery || dbPlaceQuery
  );
  const [placeResults, setPlaceResults] = useState<GeoHit[] | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const { cities, loading, error, fetchCities } = useNearbyCities();

  const runFetchCities = async () => {
    if (!lat || !lng || !radius) return;
    const now = new Date().toISOString();
    await fetchCities(Number(lat), Number(lng), Number(radius));
    setLastFetched(now);
  };

  // On mount: if we have no cached list, attempt a fetch using current center
  useEffect(() => {
    if (!Array.isArray(content.allCities) || content.allCities.length === 0) {
      runFetchCities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (city: string) => {
    setSelected((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const filteredCities = useMemo(() => {
    const term = citySearch.trim().toLowerCase();
    const base = term
      ? cities.filter((c) => c.name.toLowerCase().includes(term))
      : cities.slice();
    base.sort((a, b) =>
      sortBy === 'alpha' ? a.name.localeCompare(b.name) : a.distance - b.distance
    );
    return base;
  }, [cities, citySearch, sortBy]);

  const save = () => {
    const included = cities.filter((c) => selected.includes(c.name));
    const sortedAll = filteredCities.length
      ? filteredCities
      : cities.slice().sort((a, b) =>
          sortBy === 'alpha' ? a.name.localeCompare(b.name) : a.distance - b.distance
        );

    onSave({
      ...block,
      content: {
        ...content,
        placeQuery,
        cities: included.map((c) => c.name),
        allCities: sortedAll.map((c) => c.name),
        sourceLat: Number(lat),
        sourceLng: Number(lng),
        radiusMiles: Number(radius),
        lastFetched,
      },
    });
  };

  const selectedMarkers = cities.filter((c) => selected.includes(c.name));
  const unselectedMarkers = cities.filter((c) => !selected.includes(c.name));

  // NEW: client-side geocoding via Nominatim
  async function lookupPlace() {
    const q = placeQuery.trim();
    if (!q) return;
    setPlaceLoading(true);
    setPlaceError(null);
    setPlaceResults(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
      const data = (await res.json()) as GeoHit[];
      setPlaceResults(data);
      if (data.length === 1) {
        const hit = data[0];
        setLat(hit.lat);
        setLng(hit.lon);
      }
    } catch (e: any) {
      setPlaceError(e?.message || 'Lookup failed');
    } finally {
      setPlaceLoading(false);
    }
  }

  function applyHit(hit: GeoHit) {
    setLat(hit.lat);
    setLng(hit.lon);
    setPlaceResults(null);
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 shadow-sm">
          {/* City/State or Address lookup */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-zinc-300">City, State or Address</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., 1600 7th Ave, Seattle, WA"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lookupPlace();
                }}
                className="bg-zinc-950/60 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
              <Button onClick={lookupPlace} disabled={placeLoading} className="shrink-0">
                {placeLoading ? 'Looking…' : 'Lookup'}
              </Button>
            </div>

            {placeError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {placeError}
              </div>
            )}

            {placeResults && placeResults.length > 1 && (
              <div className="rounded-md border border-white/10 bg-zinc-950/70">
                <div className="px-3 py-2 text-xs text-zinc-400 border-b border-white/10">
                  Select a match
                </div>
                <ul className="max-h-40 overflow-auto">
                  {placeResults.map((hit) => (
                    <li key={`${hit.lat},${hit.lon}`}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60"
                        onClick={() => applyHit(hit)}
                        title={`${hit.lat}, ${hit.lon}`}
                      >
                        {hit.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Input
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="bg-zinc-950/60 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-violet-500"
            />
            <Input
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="bg-zinc-950/60 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-violet-500"
            />
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-300">
                Radius: <span className="font-medium text-white">{radius}</span> miles
              </label>
              <span className="text-xs text-zinc-400">
                {lastFetched ? `Last fetched: ${new Date(lastFetched).toLocaleString()}` : 'Not fetched yet'}
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="mt-2 w-full accent-violet-500"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={runFetchCities} disabled={loading || !lat || !lng} className="h-8">
              {loading ? 'Refreshing…' : 'Refresh Cities'}
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="sortby" className="text-sm text-zinc-300">
                Sort by:
              </label>
              <select
                id="sortby"
                className="text-sm bg-zinc-950/60 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'distance' | 'alpha')}
              >
                <option value="distance">Distance</option>
                <option value="alpha">A–Z</option>
              </select>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="accent-violet-500"
              checked={showAllPins}
              onChange={() => setShowAllPins(!showAllPins)}
            />
            Show all pins
          </label>

          {error && (
            <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {String(error)}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-2 shadow-sm h-80">
          {lat && lng ? (
            <MapWrapper
              lat={Number(lat)}
              lng={Number(lng)}
              selected={selectedMarkers}
              unselected={unselectedMarkers}
              showAllPins={showAllPins}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">
              Enter a city/state or latitude & longitude to preview the map
            </div>
          )}
        </div>
      </div>

      {/* Cities */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/60">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-white/10 bg-zinc-900/80 px-3 py-2 backdrop-blur">
          <Input
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Search cities…"
            className="h-8 w-64 bg-zinc-950/60 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          <div className="ml-auto text-xs text-zinc-300">
            Selected: <span className="font-medium text-white">{selected.length}</span>
          </div>
          <div className="ml-2 flex gap-2">
            <Button size="sm" className="h-7" onClick={() => setSelected(filteredCities.map((c) => c.name))}>
              Select All
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setSelected([])}>
              Deselect All
            </Button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-zinc-400">Loading nearby cities…</div>}

          {!loading && filteredCities.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-400">
              No cities found. Try widening the radius or refreshing.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 p-2">
            {filteredCities.map((city) => {
              const isChecked = selected.includes(city.name);
              const miles = (city.distance * 0.621371).toFixed(1);
              return (
                <label
                  key={city.name}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-white/5 bg-zinc-950/40 px-2 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800/60 focus-within:ring-2 focus-within:ring-violet-500"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle(city.name)}
                    className="data-[state=checked]:bg-violet-500"
                  />
                  <span className="flex-1 truncate">{city.name}</span>
                  <span className="text-xs text-zinc-400 shrink-0">{miles} mi</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button onClick={save}>Save</Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
