// components/admin/templates/block-editors/service-areas-editor.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { useNearbyCities } from '@/hooks/useNearbyCities';
import { MapWrapper } from './map-wrapper';
import type { Template } from '@/types/template';
import { MapPin, Compass } from 'lucide-react';

type GeoHit = {
  display_name: string;
  lat: string;
  lon: string;
};

/* ------------------------------- helpers ------------------------------- */

function pickIdentity(template?: Template) {
  const t: any = template || {};
  const meta = (t.data?.meta as any) ?? {};
  const c = meta.contact ?? {};

  const latMeta = c?.latitude;
  const lonMeta = c?.longitude;
  const latDb = typeof t.latitude === 'number' ? t.latitude : (t.latitude != null ? Number(t.latitude) : null);
  const lonDb = typeof t.longitude === 'number' ? t.longitude : (t.longitude != null ? Number(t.longitude) : null);

  const lat = Number.isFinite(latMeta) ? latMeta : latDb;
  const lng = Number.isFinite(lonMeta) ? lonMeta : lonDb;

  const address1 =
    (typeof c.address === 'string' && c.address.trim()) ||
    (t.address_line1 ? String(t.address_line1).trim() : '');

  const address2 =
    (typeof c.address2 === 'string' && c.address2.trim()) ||
    (t.address_line2 ? String(t.address_line2).trim() : '');

  const city  = (c.city  ?? t.city  ?? '').toString().trim();
  const state = (c.state ?? t.state ?? '').toString().trim();
  const postal = (c.postal ?? t.postal_code ?? '').toString().trim();

  const placeQuery = [address1, address2, [city, state].filter(Boolean).join(', '), postal]
    .filter(Boolean)
    .join(', ')
    .trim();

  return {
    lat: Number.isFinite(lat) ? String(lat) : '',
    lng: Number.isFinite(lng) ? String(lng) : '',
    placeQuery,
    city,
    state,
    postal,
    address1,
    address2,
  };
}

export default function ServiceAreasEditor({
  block,
  onSave,
  onClose,
  template, // meta-first defaults
}: BlockEditorProps & { template: Template }) {
  const content = (block as any).content ?? {};

  // Identity defaults (meta.contact first, then legacy top-level)
  const idDefaults = useMemo(() => pickIdentity(template), [template]);

  // --- Editor state (prefer block content; else identity defaults) ---
  const [lat, setLat] = useState<string>(() =>
    content.sourceLat != null && content.sourceLat !== ''
      ? String(content.sourceLat)
      : idDefaults.lat
  );
  const [lng, setLng] = useState<string>(() =>
    content.sourceLng != null && content.sourceLng !== ''
      ? String(content.sourceLng)
      : idDefaults.lng
  );
  const [radius, setRadius] = useState(content.radiusMiles?.toString() || '30');
  const [selected, setSelected] = useState<string[]>(content.cities || []);
  const [lastFetched, setLastFetched] = useState<string | null>(content.lastFetched || null);
  const [sortBy, setSortBy] = useState<'distance' | 'alpha'>('distance');
  const [showAllPins, setShowAllPins] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  // Place lookup (shown at top, seeded from identity)
  const [placeQuery, setPlaceQuery] = useState<string>(() => content.placeQuery || idDefaults.placeQuery);
  const [placeResults, setPlaceResults] = useState<GeoHit[] | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const { cities, loading, error, fetchCities } = useNearbyCities();

  const runFetchCities = useCallback(async () => {
    if (!lat || !lng || !radius) return;
    const now = new Date().toISOString();
    await fetchCities(Number(lat), Number(lng), Number(radius));
    setLastFetched(now);
  }, [lat, lng, radius, fetchCities]);

  // On mount: seed cities if none cached
  useEffect(() => {
    if (!Array.isArray(content.allCities) || content.allCities.length === 0) {
      void runFetchCities();
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

  const selectedMarkers = cities.filter((c) => selected.includes(c.name));
  const unselectedMarkers = cities.filter((c) => !selected.includes(c.name));

  // Client-side geocoding via Nominatim
  async function lookupPlace() {
    const q = placeQuery.trim();
    if (!q) return;
    setPlaceLoading(true);
    setPlaceError(null);
    setPlaceResults(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
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
    setPlaceQuery(hit.display_name);
    setPlaceResults(null);
  }

  // Open Identity panel (if the address is wrong, nudge editors there)
  const openIdentityPanel = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: true }));
      window.dispatchEvent(
        new CustomEvent('qs:open-settings-panel', {
          detail: { panel: 'identity', openEditor: true, scroll: true, spotlightMs: 900 } as any,
        })
      );
    } catch {}
  }, []);

  // Reapply identity defaults
  const useIdentityLocation = () => {
    const id = pickIdentity(template);
    setLat(id.lat);
    setLng(id.lng);
    setPlaceQuery(id.placeQuery);
  };

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

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 shadow-sm">
          {/* Identity + shortcuts */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={useIdentityLocation} className="h-8 gap-1">
              <Compass className="h-4 w-4" />
              Use Identity Location
            </Button>
            <Button variant="ghost" size="sm" onClick={openIdentityPanel} className="h-8 gap-1">
              <MapPin className="h-4 w-4" />
              Edit Address in Identity
            </Button>
          </div>

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
