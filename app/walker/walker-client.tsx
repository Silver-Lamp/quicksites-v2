'use client';

// Store-walk gig board UI. Two lists: open gigs (claim) + "my walk today" (claimed gigs
// with one-tap route planning + mark-done). Powered by /api/walker/gigs.

import * as React from 'react';

type Gig = {
  id: string; store_name: string; address: string | null; latitude: number | null;
  longitude: number | null; location_label: string | null; status: 'open' | 'claimed' | 'completed';
};
type Board = { open: Gig[]; mine: Gig[]; plan_url: string };

const whereOf = (g: Gig) =>
  Number.isFinite(g.latitude) && Number.isFinite(g.longitude) ? '📍 exact location' : (g.address || g.location_label || 'location TBD');

export default function WalkerBoard() {
  const [board, setBoard] = React.useState<Board | null>(null);
  const [needAuth, setNeedAuth] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/walker/gigs', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setNeedAuth(true); return; }
      const j = await res.json();
      if (res.ok) { setBoard(j as Board); setNeedAuth(false); }
    } catch {
      setError('Could not load gigs.');
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: 'claim' | 'complete' | 'release') => {
    if (busy) return;
    setBusy(id + action); setError(null);
    try {
      const res = await fetch(`/api/walker/gigs/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Action failed.'); }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  if (needAuth) {
    return (
      <div className="mx-auto min-h-screen max-w-xl px-4 py-16 text-center text-zinc-700">
        <h1 className="text-2xl font-bold">🧺 Store-walk gigs</h1>
        <p className="mt-3 text-sm text-zinc-500">Sign in to see open cataloging gigs and plan your route.</p>
        <a href="/login?next=/walker" className="mt-6 inline-block rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Sign in</a>
      </div>
    );
  }

  const mineActive = (board?.mine ?? []).filter((g) => g.status === 'claimed');
  const mineDone = (board?.mine ?? []).filter((g) => g.status === 'completed');

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-zinc-900">
      <h1 className="text-2xl font-bold tracking-tight">🧺 Store-walk gigs</h1>
      <p className="mt-1 text-sm text-zinc-500">Claim the stores you’ll catalog today, then plan one efficient route across them.</p>
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {/* My walk */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">My walk today {mineActive.length ? `(${mineActive.length})` : ''}</h2>
          {mineActive.length >= 1 && board?.plan_url && (
            <a href={board.plan_url} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Plan my route →</a>
          )}
        </div>
        {mineActive.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No stores claimed yet — grab some from the open gigs below.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mineActive.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{g.store_name}</div>
                  <div className="truncate text-xs text-zinc-500">{whereOf(g)}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={busy === g.id + 'complete'} onClick={() => act(g.id, 'complete')}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Done</button>
                  <button type="button" disabled={busy === g.id + 'release'} onClick={() => act(g.id, 'release')}
                    className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50">Release</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open pool */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Open gigs {board?.open.length ? `(${board.open.length})` : ''}</h2>
        {(board?.open.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No open gigs right now. Check back soon.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {board!.open.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{g.store_name}</div>
                  <div className="truncate text-xs text-zinc-500">{whereOf(g)}</div>
                </div>
                <button type="button" disabled={busy === g.id + 'claim'} onClick={() => act(g.id, 'claim')}
                  className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">Claim</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mineDone.length > 0 && (
        <p className="mt-8 text-xs text-zinc-400">✓ {mineDone.length} completed today.</p>
      )}
    </div>
  );
}
