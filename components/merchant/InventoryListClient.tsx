'use client';

// Inventory list + per-item adjust (receive +N / set to N). Calls the owner-gated
// adjust endpoint, which applies atomically and records a ledger row, then refreshes.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { InventoryRow } from '@/lib/commerce/inventorySummary';

type Filter = 'all' | 'low' | 'out';

export default function InventoryListClient({
  rows,
  counts,
  filter,
}: {
  rows: InventoryRow[];
  counts: { all: number; low: number; out: number };
  filter: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [openHistory, setOpenHistory] = React.useState<string | null>(null);
  const active = (['all', 'low', 'out'].includes(filter) ? filter : 'all') as Filter;

  const shown = rows.filter((r) => (active === 'low' ? r.low : active === 'out' ? r.out : true));

  async function adjust(row: InventoryRow, body: { delta?: number; setTo?: number; reason?: string }) {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/items/${row.id}/adjust`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Adjust failed (${res.status})`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Adjust failed');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'low', label: 'Low stock', n: counts.low },
    { key: 'out', label: 'Out of stock', n: counts.out },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`?filter=${t.key}`}
            className={`rounded-full border px-3 py-1 ${
              active === t.key ? 'border-white/40 bg-white/10' : 'border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            {t.label} <span className="text-neutral-500">({t.n})</span>
          </a>
        ))}
      </div>

      {error && <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-neutral-400">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2 text-right">On hand</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No items.</td></tr>
            )}
            {shown.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="border-t border-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.title}</div>
                    {r.variantCount > 0 && <div className="text-xs text-neutral-500">{r.variantCount} variants</div>}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{r.sku || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.onHand === null ? <span className="text-neutral-500">∞</span> : r.onHand}
                  </td>
                  <td className="px-4 py-3">
                    {r.out && <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Out</span>}
                    {r.low && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Low</span>}
                    {r.backorder && <span className="ml-1 rounded bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">Backorder</span>}
                    {!r.out && !r.low && !r.backorder && <span className="text-xs text-neutral-500">{r.tracked ? 'In stock' : 'Untracked'}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.variantCount > 0 ? (
                        <span className="text-xs text-neutral-500">edit item</span>
                      ) : !r.tracked ? (
                        <span className="text-xs text-neutral-500">enable tracking</span>
                      ) : (
                        <AdjustControls disabled={busyId === r.id} onReceive={(n) => adjust(r, { delta: n, reason: 'receive' })} onSet={(n) => adjust(r, { setTo: n, reason: 'correction' })} />
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenHistory((cur) => (cur === r.id ? null : r.id))}
                        className="rounded border border-white/10 px-2 py-1 text-xs text-neutral-400 hover:bg-white/10 hover:text-white"
                      >
                        {openHistory === r.id ? 'Hide' : 'History'}
                      </button>
                    </div>
                  </td>
                </tr>
                {openHistory === r.id && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={5} className="px-4 py-3">
                      <HistoryPanel itemId={r.id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Adjustment = {
  id: string;
  variant_id: string | null;
  delta: number;
  new_on_hand: number | null;
  reason: string;
  note: string | null;
  created_at: string;
};

function HistoryPanel({ itemId }: { itemId: string }) {
  const [rows, setRows] = React.useState<Adjustment[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/catalog/items/${itemId}/history`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
        if (alive) setRows(json.adjustments ?? []);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Failed to load history');
      }
    })();
    return () => { alive = false; };
  }, [itemId]);

  if (err) return <div className="text-xs text-red-300">{err}</div>;
  if (rows === null) return <div className="text-xs text-neutral-500">Loading history…</div>;
  if (!rows.length) return <div className="text-xs text-neutral-500">No adjustments recorded yet.</div>;

  return (
    <div className="space-y-1">
      <div className="mb-1 text-xs font-medium text-neutral-400">Adjustment history</div>
      {rows.map((a) => (
        <div key={a.id} className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0 text-neutral-500">{new Date(a.created_at).toLocaleString()}</span>
          <span className={`w-14 shrink-0 text-right tabular-nums ${a.delta < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
            {a.delta > 0 ? `+${a.delta}` : a.delta}
          </span>
          <span className="w-24 shrink-0 capitalize text-neutral-400">{a.reason}</span>
          <span className="text-neutral-500">
            {a.new_on_hand !== null ? `→ ${a.new_on_hand} on hand` : ''}{a.variant_id ? ` · ${a.variant_id}` : ''}{a.note ? ` · ${a.note}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdjustControls({ disabled, onReceive, onSet }: { disabled: boolean; onReceive: (n: number) => void; onSet: (n: number) => void }) {
  const [n, setN] = React.useState('');
  const val = Math.max(0, Math.floor(Number(n) || 0));
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        min="0"
        value={n}
        onChange={(e) => setN(e.target.value)}
        placeholder="qty"
        className="w-16 rounded bg-neutral-900 px-2 py-1 text-right text-sm ring-1 ring-neutral-800"
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled || n === ''}
        onClick={() => { onReceive(val); setN(''); }}
        title="Receive this many into stock"
        className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
      >
        + Receive
      </button>
      <button
        type="button"
        disabled={disabled || n === ''}
        onClick={() => { onSet(val); setN(''); }}
        title="Set on-hand to this exact number"
        className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
      >
        Set
      </button>
    </div>
  );
}
