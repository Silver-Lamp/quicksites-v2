'use client';

// Tasker / realtor route planner UI. Enter the day's stops (structured rows or a bulk
// paste), optimize into a nearest-first order, hand-tune by drag or move-buttons,
// preview the path on a lightweight SVG mini-map, and hand off to Google Maps for
// turn-by-turn. Built for AisleAsk store-walkers + realtor showing tours (crosstalk §19).
//
// Pure math (haversine miles) + the Maps URL builder are imported from lib/route/* so a
// manual reorder recomputes miles + the directions link CLIENT-SIDE with no round-trip.

import * as React from 'react';
import { calculateDistance } from '@/lib/route/optimizeRoute';
import { buildMapsDirUrl, buildSingleStopUrl } from '@/lib/route/mapsUrl';

type InStop = { label?: string; address?: string; latitude?: number; longitude?: number };
type Ordered = { label: string; address: string; latitude: number; longitude: number };
type ApiResult = { start: Ordered; ordered: Ordered[]; total_miles: number; maps_url: string; unresolved: string[]; note: string };

type Row = { id: string; value: string };

let _rid = 0;
const rid = () => `r${_rid++}`;
const toRows = (lines: string[]): Row[] => (lines.length ? lines : ['']).map((v) => ({ id: rid(), value: v }));

// A stop line is an address, or coords the caller already has:
//   "Store A @30.26,-97.74" (label + coords) · "30.26,-97.74" (bare coords).
// Coords skip geocoding — how AisleAsk hands us catalogs that already carry lat/lng.
function parseStop(line: string): InStop {
  const at = line.split('@');
  if (at.length === 2) {
    const m = at[1].match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) return { label: at[0].trim() || 'Stop', latitude: Number(m[1]), longitude: Number(m[2]) };
  }
  const bare = line.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (bare) return { label: line.trim(), latitude: Number(bare[1]), longitude: Number(bare[2]) };
  return { address: line };
}

/** Sum straight-line miles across start → ordered path (client mirror of the server calc). */
function totalMiles(start: Ordered, ordered: Ordered[]): number {
  let total = 0;
  let cLat = start.latitude;
  let cLon = start.longitude;
  for (const s of ordered) {
    total += calculateDistance(cLat, cLon, s.latitude, s.longitude);
    cLat = s.latitude;
    cLon = s.longitude;
  }
  return Math.round(total * 10) / 10;
}

// ── Mini-map: plot start + ordered stops into a padded viewBox and draw the path. ──
function RouteMap({ start, ordered }: { start: Ordered; ordered: Ordered[] }) {
  const W = 320;
  const H = 200;
  const PAD = 24;
  const pts = [start, ...ordered];
  const lats = pts.map((p) => p.latitude);
  const lons = pts.map((p) => p.longitude);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLon = Math.min(...lons), maxLon = Math.max(...lons);
  // Guard against a zero-span (all stops share a coord) so we don't divide by zero.
  if (maxLat - minLat < 1e-6) { minLat -= 0.005; maxLat += 0.005; }
  if (maxLon - minLon < 1e-6) { minLon -= 0.005; maxLon += 0.005; }
  const x = (lon: number) => PAD + ((lon - minLon) / (maxLon - minLon)) * (W - 2 * PAD);
  const y = (lat: number) => PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * PAD); // flip: north is up
  const path = pts.map((p) => `${x(p.longitude).toFixed(1)},${y(p.latitude).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl border border-zinc-200 bg-zinc-50" role="img" aria-label="Route map preview">
      <polyline points={path} fill="none" stroke="#0284c7" strokeWidth={2} strokeDasharray="4 4" strokeLinejoin="round" opacity={0.7} />
      {/* start marker */}
      <circle cx={x(start.longitude)} cy={y(start.latitude)} r={9} fill="#18181b" />
      <text x={x(start.longitude)} y={y(start.latitude) + 3} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="700">◎</text>
      {ordered.map((p, i) => {
        const isReturn = i === ordered.length - 1 && p.latitude === start.latitude && p.longitude === start.longitude;
        if (isReturn) return null;
        return (
          <g key={i}>
            <circle cx={x(p.longitude)} cy={y(p.latitude)} r={9} fill="#0284c7" />
            <text x={x(p.longitude)} y={y(p.latitude) + 3.5} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="700">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function RoutePlanner({ initialStops, initialStart }: { initialStops: string[]; initialStart: string }) {
  const [start, setStart] = React.useState(initialStart);
  const [rows, setRows] = React.useState<Row[]>(() => toRows(initialStops));
  const [roundTrip, setRoundTrip] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPaste, setShowPaste] = React.useState(false);
  const [pasteText, setPasteText] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // The optimized route (server), then locally mutated by manual reorder.
  const [route, setRoute] = React.useState<{ start: Ordered; ordered: Ordered[]; unresolved: string[]; note: string } | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const setRowValue = (id: string, value: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value } : r)));
  const addRow = () => setRows((rs) => [...rs, { id: rid(), value: '' }]);
  const removeRow = (id: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [{ id: rid(), value: '' }]));

  const applyPaste = () => {
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) {
      const existing = rows.filter((r) => r.value.trim());
      setRows([...existing, ...lines.map((v) => ({ id: rid(), value: v }))]);
    }
    setPasteText('');
    setShowPaste(false);
  };

  const optimize = async () => {
    if (busy) return;
    const stops = rows.map((r) => r.value.trim()).filter(Boolean).map(parseStop);
    if (!stops.length) { setError('Add at least one stop.'); return; }
    setBusy(true); setError(null); setRoute(null);
    try {
      const res = await fetch('/api/tools/route-optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops, start: start.trim() ? parseStop(start.trim()) : undefined, round_trip: roundTrip }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not plan the route.');
      const r = j as ApiResult;
      setRoute({ start: r.start, ordered: r.ordered, unresolved: r.unresolved, note: r.note });
    } catch (e: any) {
      setError(e?.message || 'Could not plan the route.');
    } finally { setBusy(false); }
  };

  // Manual reorder of the optimized list (drag on desktop, move-buttons everywhere).
  const move = (from: number, to: number) => {
    setRoute((prev) => {
      if (!prev) return prev;
      if (to < 0 || to >= prev.ordered.length) return prev;
      const next = [...prev.ordered];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, ordered: next };
    });
  };

  // Derived from the (possibly reordered) route — recomputed on the client, no round-trip.
  const derived = React.useMemo(() => {
    if (!route) return null;
    return { miles: totalMiles(route.start, route.ordered), mapsUrl: buildMapsDirUrl(route.ordered, route.start) };
  }, [route]);

  const copyMaps = async () => {
    if (!derived) return;
    try { await navigator.clipboard.writeText(derived.mapsUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };

  const filledCount = rows.filter((r) => r.value.trim()).length;
  const inputCls = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[15px] text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 sm:pt-12">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">🗺️ Route planner</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            Add your stops for the day, optimize into a nearest-first order, then hand off to Google Maps for turn-by-turn.
          </p>
        </header>

        {/* ── Stops card ── */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Start point</span>
            <span className="ml-1 text-xs font-normal text-zinc-400">optional — your first stop if blank</span>
            <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="123 Main St, Springfield, IL" className={`mt-1.5 ${inputCls}`} />
          </label>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Stops {filledCount > 0 && <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">{filledCount}</span>}
            </span>
            <button type="button" onClick={() => setShowPaste((v) => !v)} className="text-xs font-semibold text-sky-600 hover:text-sky-700">
              {showPaste ? 'Close paste' : '＋ Paste a list'}
            </button>
          </div>

          {showPaste && (
            <div className="mt-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-2.5">
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4}
                placeholder={'One stop per line:\nStore A, 500 Oak Ave, Springfield, IL\nStore B, 88 Elm St, Springfield, IL'}
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-sky-500" />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setPasteText(''); setShowPaste(false); }} className="rounded-md px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700">Cancel</button>
                <button type="button" onClick={applyPaste} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700">Add lines</button>
              </div>
            </div>
          )}

          <ul className="mt-2 space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 tabular-nums">{i + 1}</span>
                <input
                  value={r.value}
                  onChange={(e) => setRowValue(r.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === rows.length - 1) addRow(); } }}
                  placeholder="Address, or “Name @lat,lng”"
                  className={inputCls}
                  aria-label={`Stop ${i + 1}`}
                />
                <button type="button" onClick={() => removeRow(r.id)} aria-label={`Remove stop ${i + 1}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-500">✕</button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={addRow} className="mt-3 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-sm font-semibold text-zinc-500 transition hover:border-sky-400 hover:text-sky-600">
            ＋ Add stop
          </button>

          <label className="mt-4 flex items-center gap-2.5 text-sm text-zinc-700">
            <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="h-4 w-4 rounded accent-sky-600" />
            Return to start at the end (round trip)
          </label>

          {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
        </section>

        {/* ── Result ── */}
        {route && derived && (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Your route</h2>
              <span className="text-sm font-semibold tabular-nums text-zinc-500">≈ {derived.miles} mi</span>
            </div>

            <div className="mt-4">
              <RouteMap start={route.start} ordered={route.ordered} />
            </div>

            <ol className="mt-4 space-y-1.5">
              <li className="flex items-center gap-3 rounded-lg bg-zinc-50 px-2.5 py-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">◎</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{route.start.label}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Start</span>
              </li>
              {route.ordered.map((r, i) => {
                const isReturn = roundTrip && i === route.ordered.length - 1 && r.latitude === route.start.latitude && r.longitude === route.start.longitude;
                return (
                  <li
                    key={i}
                    draggable={!isReturn}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => { if (dragIndex !== null && !isReturn) e.preventDefault(); }}
                    onDrop={() => { if (dragIndex !== null && dragIndex !== i && !isReturn) move(dragIndex, i); setDragIndex(null); }}
                    onDragEnd={() => setDragIndex(null)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${dragIndex === i ? 'opacity-40' : ''} ${isReturn ? 'bg-zinc-50' : 'bg-white hover:bg-sky-50/60'}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isReturn ? 'bg-zinc-200 text-zinc-500' : 'bg-sky-600 text-white'}`}>
                      {isReturn ? '◎' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{r.label}</span>
                    {isReturn ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Return</span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up"
                          className="grid h-7 w-7 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => move(i, i + 1)} disabled={i >= route.ordered.length - 1 || (roundTrip && i === route.ordered.length - 2)} aria-label="Move down"
                          className="grid h-7 w-7 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30">↓</button>
                        <a href={buildSingleStopUrl(r)} target="_blank" rel="noopener noreferrer" aria-label="Navigate to this stop"
                          className="hidden h-7 w-7 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-sky-600 sm:grid" title="Navigate to just this stop">➤</a>
                        <span className="hidden cursor-grab select-none px-1 text-zinc-300 sm:inline" title="Drag to reorder">⠿</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a href={derived.mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                Open in Google Maps →
              </a>
              <button type="button" onClick={copyMaps}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
            </div>

            {route.unresolved.length > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Couldn’t locate: {route.unresolved.join(', ')} — check the spelling or add a city/ZIP.
              </p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">{route.note}</p>
          </section>
        )}
      </div>

      {/* ── Sticky action bar (mobile-first) ── */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button type="button" onClick={optimize} disabled={busy || filledCount === 0}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-40">
            {busy ? 'Planning…' : route ? 'Re-plan route' : `Plan my route${filledCount ? ` (${filledCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
