'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Sub = {
  id: string; status: 'active'|'queued'|'notified'|'unsubscribed';
  created_at: string; notified_at: string | null;
  meal_id: string;
  meals?: { title: string; image_url: string | null; qty_available: number | null; is_active: boolean; slug: string | null; } | null;
};

export default function AlertsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/alerts/my');
    const data = await r.json();
    setSubs(data?.subs ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function unsubOne(id: string) {
    setBusy(id);
    const r = await fetch('/api/alerts/delete', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ subscriptionId: id }) });
    setBusy(null);
    if (r.ok) load();
  }
  async function unsubAll() {
    setBusy('all');
    const r = await fetch('/api/alerts/delete', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ all: true }) });
    setBusy(null);
    if (r.ok) load();
  }
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My alerts</h1>
        {subs.length > 0 && (
          <button onClick={unsubAll} disabled={busy==='all'} className="rounded-md border px-3 py-1 text-sm">
            {busy==='all' ? 'Working…' : 'Unsubscribe all'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : subs.length === 0 ? (
        <div className="text-sm text-muted-foreground">You don’t have any active alerts.</div>
      ) : (
        <div className="grid gap-3">
          {subs.map(s => {
            const m = s.meals;
            const soldOut = !(m?.is_active) || (m?.qty_available === 0);
            const href = `/meals/${m?.slug || s.meal_id}`;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border p-3">
                {m?.image_url ? (
                  <img src={m.image_url} alt={m.title} className="w-16 h-16 rounded-md object-cover border" />
                ) : (<div className="w-16 h-16 rounded-md bg-muted border" />)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m?.title || 'Meal'}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.status}{s.notified_at ? ` • notified ${new Date(s.notified_at).toLocaleString()}` : ''}
                  </div>
                </div>
                <Link href={href} className="rounded-md border px-3 py-1 text-xs">
                  View
                </Link>
                {(s.status === 'active' || s.status === 'queued') && (
                  <button
                    onClick={() => unsubOne(s.id)}
                    disabled={busy === s.id}
                    className="rounded-md border px-3 py-1 text-xs"
                  >
                    {busy === s.id ? 'Working…' : 'Unsubscribe'}
                  </button>
                )}
                {!soldOut && <span className="text-xs text-emerald-700">Available</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
