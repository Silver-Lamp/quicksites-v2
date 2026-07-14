'use client';

// components/admin/parks-prewarm-panel.tsx
//
// Operator panel to pre-warm the industrial-park registry for a metro and eyeball what
// Google Places returned BEFORE the lazy resolver feeds those parks onto live pitch-site
// default addresses. Hits POST /api/admin/parks/prewarm (sweep) and GET (read-only
// preview). Cheap — Places Text Search only, no AI. Gated by PARKS_REGISTRY_ENABLED
// server-side (a disabled registry returns a clear 400 shown inline here).

import { useState } from 'react';

type ParkRow = {
  placeId: string;
  name: string;
  street: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  uses: string[];
  sampleSuite: string;
};

type PrewarmResult = { area: string; swept: boolean; count: number; parks: ParkRow[] };

export default function ParksPrewarmPanel() {
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState<null | 'sweep' | 'peek'>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrewarmResult | null>(null);

  async function run(mode: 'sweep' | 'peek') {
    const c = city.trim();
    if (!c) {
      setError('Enter a city.');
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      let res: Response;
      if (mode === 'sweep') {
        res = await fetch('/api/admin/parks/prewarm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city: c, region: region.trim() || undefined }),
        });
      } else {
        const qs = new URLSearchParams({ city: c, ...(region.trim() ? { region: region.trim() } : {}) });
        res = await fetch(`/api/admin/parks/prewarm?${qs.toString()}`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}).`);
      setResult(json as PrewarmResult);
    } catch (e: any) {
      setResult(null);
      setError(e?.message || 'Failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Pull real industrial / flex-office parks for a metro from Google Places and store them, so pitch-site default
        addresses land in a real building (with a synthetic suite). The registry is the cache — a metro is swept once.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Renton)"
          className="w-44 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 placeholder-neutral-600"
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="ST"
          maxLength={2}
          className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm uppercase text-neutral-100 placeholder-neutral-600"
        />
        <button
          onClick={() => run('sweep')}
          disabled={busy !== null}
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy === 'sweep' ? 'Sweeping…' : 'Pre-warm'}
        </button>
        <button
          onClick={() => run('peek')}
          disabled={busy !== null}
          className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy === 'peek' ? 'Loading…' : 'View stored'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-400">
            <span className="font-mono text-neutral-500">{result.area}</span> — {result.count} park
            {result.count === 1 ? '' : 's'}{' '}
            {result.swept ? (
              <span className="text-emerald-400">· swept from Places just now</span>
            ) : (
              <span className="text-neutral-500">· from registry (already covered)</span>
            )}
          </p>
          {result.count === 0 ? (
            <p className="text-xs text-neutral-500">
              No parks — geocoding failed, Places isn&apos;t configured, or there genuinely are none nearby.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-neutral-900 text-neutral-500">
                  <tr>
                    <th className="px-2 py-1 font-medium">Park</th>
                    <th className="px-2 py-1 font-medium">Address</th>
                    <th className="px-2 py-1 font-medium">Sample suite</th>
                    <th className="px-2 py-1 font-medium">Uses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {result.parks.map((p) => (
                    <tr key={p.placeId} className="text-neutral-300">
                      <td className="px-2 py-1">{p.name}</td>
                      <td className="px-2 py-1 text-neutral-400">
                        {p.street ?? <span className="italic text-neutral-600">(no street)</span>}
                        {p.city ? `, ${p.city}` : ''}
                        {p.region ? `, ${p.region}` : ''}
                      </td>
                      <td className="px-2 py-1 font-mono text-emerald-300">{p.sampleSuite}</td>
                      <td className="px-2 py-1 text-neutral-500">{p.uses.join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
