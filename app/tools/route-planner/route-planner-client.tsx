'use client';

// Tasker route planner UI. Paste the day's store stops (one address per line), optimize,
// and get a numbered walk order + total straight-line miles + a Google Maps directions
// link for turn-by-turn. Built for the AisleAsk store-walk taskers (crosstalk §19).

import * as React from 'react';

type Ordered = { label: string; address: string; latitude: number; longitude: number };
type Result = { start: Ordered; ordered: Ordered[]; total_miles: number; maps_url: string; unresolved: string[]; note: string };

export default function RoutePlanner({ initialStops, initialStart }: { initialStops: string[]; initialStart: string }) {
  const [start, setStart] = React.useState(initialStart);
  const [text, setText] = React.useState(initialStops.join('\n'));
  const [roundTrip, setRoundTrip] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);

  const optimize = async () => {
    if (busy) return;
    const stops = text.split('\n').map((l) => l.trim()).filter(Boolean).map((address) => ({ address }));
    if (!stops.length) { setError('Add at least one stop, one address per line.'); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/tools/route-optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops, start: start.trim() ? { address: start.trim() } : undefined, round_trip: roundTrip }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not plan the route.');
      setResult(j as Result);
    } catch (e: any) {
      setError(e?.message || 'Could not plan the route.');
    } finally { setBusy(false); }
  };

  const inputCls = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500';

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-zinc-900">
      <h1 className="text-2xl font-bold tracking-tight">🗺️ Store-walk route planner</h1>
      <p className="mt-1 text-sm text-zinc-500">Paste your stops for the day — one address per line. We’ll order them nearest-first and hand you turn-by-turn directions.</p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Start (optional — your first stop if blank)</span>
          <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="123 Main St, Springfield, IL" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Stops (one address per line)</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={'Store A, 500 Oak Ave, Springfield, IL\nStore B, 88 Elm St, Springfield, IL'} className={`mt-1 font-mono ${inputCls}`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="h-4 w-4" />
          Return to start at the end (round trip)
        </label>
        <button type="button" onClick={optimize} disabled={busy}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? 'Planning…' : 'Plan my route'}
        </button>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Your route</h2>
            <span className="text-sm font-semibold tabular-nums text-zinc-500">≈ {result.total_miles} mi</span>
          </div>
          <ol className="mt-4 space-y-2">
            <li className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold">◎</span>
              <span className="text-sm font-medium">{result.start.label}</span>
            </li>
            {result.ordered.map((r, i) => {
              const isReturn = roundTrip && i === result.ordered.length - 1;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${isReturn ? 'bg-zinc-200' : 'bg-sky-600 text-white'}`}>
                    {isReturn ? '◎' : i + 1}
                  </span>
                  <span className="text-sm">{r.label}</span>
                </li>
              );
            })}
          </ol>
          <a href={result.maps_url} target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Open in Google Maps →
          </a>
          {result.unresolved.length > 0 && (
            <p className="mt-3 text-xs text-amber-600">Couldn’t locate: {result.unresolved.join(', ')} — check the address and try again.</p>
          )}
          <p className="mt-3 text-[11px] text-zinc-400">{result.note}</p>
        </div>
      )}
    </div>
  );
}
