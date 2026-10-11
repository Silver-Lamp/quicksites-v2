'use client';

// components/for-rep/sweep-here.tsx
//
// "Sweep where you are." A visitor presses one button (or types a city), the restaurants around
// them are read from Google and their own sites, and the grouped list appears — with build
// buttons when the page carries a rep grant, read-only when it does not. Every sweep grows the
// database one city at a time; the server bounds the spend (app/api/rep/sweep/route.ts).
import * as React from 'react';
import RestaurantTable, { type RestaurantTableRow } from '@/components/for-rep/restaurant-table';

type Result = {
  city: string;
  region: string;
  swept: boolean;
  reason?: 'recent' | 'daily_cap';
  found?: number;
  inserted?: number;
  sweptOn: string | null;
  checkedOn: string | null;
  rows: RestaurantTableRow[];
  counts: { call: number; shop: number; thirdParty: number; siteOnly: number; leaveAlone: number; unchecked: number; total: number };
};

export default function SweepHere({ code, token, repName, initialCity, initialRegion }: { code?: string | null; token?: string | null; repName?: string | null; initialCity?: string; initialRegion?: string }) {
  const [city, setCity] = React.useState(initialCity ?? '');
  const [region, setRegion] = React.useState(initialRegion ?? '');
  const [busy, setBusy] = React.useState<'locate' | 'sweep' | null>(null);
  const [note, setNote] = React.useState('');
  const [result, setResult] = React.useState<Result | null>(null);

  async function run(body: Record<string, unknown>) {
    setBusy('sweep');
    setNote('Reading the restaurants around there — Google first, then each one’s own website. This can take a minute.');
    try {
      const res = await fetch('/api/rep/sweep', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, code: code ?? undefined }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setNote(
          res.status === 429 ? 'That is two sweeps from this connection today, and nobody has swept that city yet — the limit exists because each one costs money. Try tomorrow, or type a city someone has already swept. (Signed in as the operator, there is no limit.)'
          : j?.error === 'could_not_place_you' ? 'Could not work out which town that is. Type the city and state instead.'
          : j?.error === 'places_unavailable' ? 'The map service is not answering right now. Tell Sandon.'
          : `Could not sweep (${j?.error ?? res.status}).`,
        );
        return;
      }
      setResult(j);
      setCity(j.city);
      setRegion(j.region);
      setNote(
        j.swept
          ? `Swept ${j.city}, ${j.region}: ${j.found ?? '?'} places found, ${j.inserted ?? 0} new to us. ${j.counts.call + j.counts.shop + j.counts.thirdParty} worth a visit.`
          : j.reason === 'daily_cap'
            ? `Everyone's sweeps for today are used up; here is what we already hold for ${j.city}.`
            : j.reason === 'ip_cap'
              ? `That is two sweeps from this connection today, so nothing new was read — but ${j.city}, ${j.region} has been swept before${j.sweptOn ? ` (${new Date(j.sweptOn).toLocaleDateString()})` : ''}; here is what we hold.`
            : `${j.city}, ${j.region} was swept ${j.sweptOn ? new Date(j.sweptOn).toLocaleDateString() : 'recently'} — here is what we hold.`,
      );
    } catch {
      setNote('Network hiccup — try again.');
    } finally {
      setBusy(null);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setNote('Your browser will not share a location here. Type the city and state instead.');
      return;
    }
    setBusy('locate');
    setNote('Asking your phone where you are…');
    navigator.geolocation.getCurrentPosition(
      (pos) => void run({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        setBusy(null);
        setNote('Location was refused. Type the city and state instead.');
      },
      { timeout: 15_000, maximumAge: 300_000 },
    );
  }

  const visit = result ? result.counts.call + result.counts.shop + result.counts.thirdParty : 0;

  return (
    <div className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" disabled={busy !== null} onClick={locate} className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-sky-400 disabled:opacity-50">
          {busy === 'locate' ? 'Locating…' : busy === 'sweep' ? 'Sweeping…' : 'Sweep where I am'}
        </button>
        <span className="text-xs text-zinc-500">or</span>
        <label className="text-sm">
          <span className="block text-xs text-zinc-500">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Renton" className="mt-1 w-40 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-zinc-500">State</span>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="WA" maxLength={2} className="mt-1 w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm uppercase text-white" />
        </label>
        <button type="button" disabled={busy !== null || !city.trim() || region.trim().length !== 2} onClick={() => void run({ city: city.trim(), region: region.trim() })} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
          Sweep this city
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {note || 'Two sweeps a day per connection, and a city swept in the last week is shown rather than swept again — each sweep costs money, and the database only needs it once.'}
      </p>
      {result && (
        <div className="mt-3">
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-white">{result.city}, {result.region}</span> — {result.counts.total} restaurants with a website · {visit} worth a visit
            {result.counts.unchecked ? ` · ${result.counts.unchecked} not yet read` : ''}.
          </p>
          {result.rows.length > 0 && <RestaurantTable rows={result.rows} token={token ?? ''} repName={repName ?? 'a QuickSites rep'} readOnly={!token} />}
          {!token && result.rows.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">The build buttons appear on a rep’s own page, where every link carries their code. These are the doors; the code is how you get paid for walking through them.</p>
          )}
        </div>
      )}
    </div>
  );
}
