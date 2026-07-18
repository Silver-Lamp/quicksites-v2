'use client';

// Tasker / realtor route planner UI. Enter the day's stops (structured rows or a bulk
// paste), optimize into a nearest-first order, hand-tune by drag or move-buttons,
// preview the path on a lightweight SVG mini-map, and hand off to Google Maps for
// turn-by-turn. Built for AisleAsk store-walkers + realtor showing tours (crosstalk §19).
//
// Theme: dark by DEFAULT, with a header toggle (persisted to localStorage). Styling is
// Tailwind class-strategy dark mode — base classes are light, `dark:` variants are dark,
// and the root gets a `.dark` class when dark is active (default), so SSR renders dark
// with no toggle library.
//
// Pure math (haversine miles) + the Maps URL builder + the optimizer come from lib/route/*
// so both a manual reorder AND the "Show example" demo run entirely CLIENT-SIDE — the
// example uses coordinates (no geocoding, no server round-trip), so it never consumes the
// endpoint's per-IP rate limit.

import * as React from 'react';
import { calculateDistance, optimizeRoute } from '@/lib/route/optimizeRoute';
import { buildMapsDirUrl, buildSingleStopUrl } from '@/lib/route/mapsUrl';

type InStop = { label?: string; address?: string; latitude?: number; longitude?: number };
type Ordered = { label: string; address: string; latitude: number; longitude: number };
type ApiResult = { start: Ordered; ordered: Ordered[]; total_miles: number; maps_url: string; unresolved: string[]; note: string };

type Row = { id: string; value: string };
type Theme = 'dark' | 'light';
const THEME_KEY = 'qs-route-planner-theme';

let _rid = 0;
const rid = () => `r${_rid++}`;
const toRows = (lines: string[]): Row[] => (lines.length ? lines : ['']).map((v) => ({ id: rid(), value: v }));

// A demo day: five real store coords around Austin + a downtown start. Coordinates (not
// addresses) so the example resolves instantly on the client — no geocoding, no server hit.
const EXAMPLE_START = 'Downtown Austin @30.2672,-97.7431';
const EXAMPLE_STOPS = [
  'H-E-B Mueller @30.2985,-97.7047',
  'Whole Foods (The Domain) @30.4009,-97.7256',
  'Central Market North @30.3009,-97.7434',
  'Costco Southpark Meadows @30.1728,-97.7920',
  "Trader Joe's (Rock Rose) @30.4014,-97.7205",
];

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
// SVG fills are attributes (not Tailwind), so the palette is picked from the `dark` flag.
function RouteMap({ start, ordered, dark }: { start: Ordered; ordered: Ordered[]; dark: boolean }) {
  const W = 320;
  const H = 200;
  const PAD = 24;
  const stroke = dark ? '#38bdf8' : '#0284c7';
  const startFill = dark ? '#e4e4e7' : '#18181b';
  const startGlyph = dark ? '#09090b' : '#ffffff';
  const stopFill = dark ? '#0ea5e9' : '#0284c7';
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
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60" role="img" aria-label="Route map preview">
      <polyline points={path} fill="none" stroke={stroke} strokeWidth={2} strokeDasharray="4 4" strokeLinejoin="round" opacity={0.8} />
      {/* start marker */}
      <circle cx={x(start.longitude)} cy={y(start.latitude)} r={9} fill={startFill} />
      <text x={x(start.longitude)} y={y(start.latitude) + 3} textAnchor="middle" fontSize={9} fill={startGlyph} fontWeight="700">◎</text>
      {ordered.map((p, i) => {
        const isReturn = i === ordered.length - 1 && p.latitude === start.latitude && p.longitude === start.longitude;
        if (isReturn) return null;
        return (
          <g key={i}>
            <circle cx={x(p.longitude)} cy={y(p.latitude)} r={9} fill={stopFill} />
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

  // Theme: default dark (matches SSR); hydrate the saved preference after mount so the
  // initial render never mismatches. Persist on toggle.
  const [theme, setTheme] = React.useState<Theme>('dark');
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {}
  }, []);
  const toggleTheme = () =>
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      return next;
    });
  const isDark = theme === 'dark';

  // The optimized route (server), then locally mutated by manual reorder.
  const [route, setRoute] = React.useState<{ start: Ordered; ordered: Ordered[]; unresolved: string[]; note: string } | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const resultRef = React.useRef<HTMLDivElement | null>(null);

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

  const scrollToResult = () => {
    // Let the result render first, then bring it into view (nice on mobile).
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Fill the form with a sample day and plan it — entirely CLIENT-SIDE (coords, no
  // geocoding), so the demo is instant and never touches the rate-limited endpoint.
  const showExample = () => {
    setStart(EXAMPLE_START);
    setRows(toRows(EXAMPLE_STOPS));
    setRoundTrip(false);
    setError(null);
    const stops: Ordered[] = EXAMPLE_STOPS.map(parseStop).map((p) => ({
      label: p.label || 'Stop',
      address: '',
      latitude: p.latitude as number,
      longitude: p.longitude as number,
    }));
    const sp = parseStop(EXAMPLE_START);
    const startResolved: Ordered = { label: sp.label || 'Start', address: '', latitude: sp.latitude as number, longitude: sp.longitude as number };
    const ordered = optimizeRoute(startResolved.latitude, startResolved.longitude, stops);
    setRoute({
      start: startResolved,
      ordered,
      unresolved: [],
      note: 'Example route — straight-line order; distance is as-the-crow-flies, not driving miles.',
    });
    scrollToResult();
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
      scrollToResult();
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
  const inputCls =
    'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[15px] text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-sky-500/20';

  return (
    // Theme scope: `.dark` on this ancestor drives every `dark:` utility below (class
    // strategy needs .dark on an ANCESTOR, not the same element that carries dark:*).
    <div className={isDark ? 'dark' : undefined}>
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-zinc-900 dark:from-slate-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 sm:pt-12">
        <header>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">🗺️ Route planner</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                Add your stops for the day, optimize into a nearest-first order, then hand off to Google Maps for turn-by-turn.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
                className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <button
                type="button"
                onClick={showExample}
                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:border-sky-400 dark:hover:bg-sky-500/20"
              >
                ✨ Show example
              </button>
            </div>
          </div>
        </header>

        {/* ── Stops card ── */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Start point</span>
            <span className="ml-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">optional — your first stop if blank</span>
            <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="123 Main St, Springfield, IL" className={`mt-1.5 ${inputCls}`} />
          </label>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Stops {filledCount > 0 && <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">{filledCount}</span>}
            </span>
            <button type="button" onClick={() => setShowPaste((v) => !v)} className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
              {showPaste ? 'Close paste' : '＋ Paste a list'}
            </button>
          </div>

          {showPaste && (
            <div className="mt-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-950/50">
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4}
                placeholder={'One stop per line:\nStore A, 500 Oak Ave, Springfield, IL\nStore B, 88 Elm St, Springfield, IL'}
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder-zinc-600" />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setPasteText(''); setShowPaste(false); }} className="rounded-md px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">Cancel</button>
                <button type="button" onClick={applyPaste} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">Add lines</button>
              </div>
            </div>
          )}

          <ul className="mt-2 space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 tabular-nums dark:bg-zinc-800 dark:text-zinc-400">{i + 1}</span>
                <input
                  value={r.value}
                  onChange={(e) => setRowValue(r.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === rows.length - 1) addRow(); } }}
                  placeholder="Address, or “Name @lat,lng”"
                  className={inputCls}
                  aria-label={`Stop ${i + 1}`}
                />
                <button type="button" onClick={() => removeRow(r.id)} aria-label={`Remove stop ${i + 1}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400">✕</button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={addRow} className="mt-3 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-sm font-semibold text-zinc-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-sky-500 dark:hover:text-sky-300">
            ＋ Add stop
          </button>

          <label className="mt-4 flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="h-4 w-4 rounded accent-sky-600 dark:accent-sky-500" />
            Return to start at the end (round trip)
          </label>

          {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
        </section>

        {/* ── Result ── */}
        {route && derived && (
          <section ref={resultRef} className="mt-6 scroll-mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Your route</h2>
              <span className="text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">≈ {derived.miles} mi</span>
            </div>

            <div className="mt-4">
              <RouteMap start={route.start} ordered={route.ordered} dark={isDark} />
            </div>

            <ol className="mt-4 space-y-1.5">
              <li className="flex items-center gap-3 rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-800/50">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">◎</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{route.start.label}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Start</span>
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
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${dragIndex === i ? 'opacity-40' : ''} ${isReturn ? 'bg-zinc-50 dark:bg-zinc-800/50' : 'bg-white hover:bg-sky-50/60 dark:bg-transparent dark:hover:bg-sky-500/10'}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isReturn ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400' : 'bg-sky-600 text-white dark:bg-sky-500'}`}>
                      {isReturn ? '◎' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">{r.label}</span>
                    {isReturn ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Return</span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up"
                          className="grid h-7 w-7 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">↑</button>
                        <button type="button" onClick={() => move(i, i + 1)} disabled={i >= route.ordered.length - 1 || (roundTrip && i === route.ordered.length - 2)} aria-label="Move down"
                          className="grid h-7 w-7 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">↓</button>
                        <a href={buildSingleStopUrl(r)} target="_blank" rel="noopener noreferrer" aria-label="Navigate to this stop"
                          className="hidden h-7 w-7 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-sky-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-sky-400 sm:grid" title="Navigate to just this stop">➤</a>
                        <span className="hidden cursor-grab select-none px-1 text-zinc-300 dark:text-zinc-600 sm:inline" title="Drag to reorder">⠿</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a href={derived.mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 dark:hover:bg-emerald-500">
                Open in Google Maps →
              </a>
              <button type="button" onClick={copyMaps}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
            </div>

            {route.unresolved.length > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Couldn’t locate: {route.unresolved.join(', ')} — check the spelling or add a city/ZIP.
              </p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">{route.note}</p>
          </section>
        )}
      </div>

      {/* ── Sticky action bar (mobile-first) ── */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-2xl">
          <button type="button" onClick={optimize} disabled={busy || filledCount === 0}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-40 dark:hover:bg-sky-500">
            {busy ? 'Planning…' : route ? 'Re-plan route' : `Plan my route${filledCount ? ` (${filledCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
