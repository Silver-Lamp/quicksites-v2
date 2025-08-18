// components/admin/commerce/orders-table.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Order = {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded' | 'failed' | string;
  provider_payment_id: string | null;
  created_at: string;
};

export default function OrdersTable({
  merchantId,
  siteId,
}: {
  merchantId: string;
  siteId?: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const dtFmt = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    []
  );
  const formatAmount = (cents: number, code: string) => {
    const currency = (code || 'USD').toUpperCase();
    const amount = (cents ?? 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
      // fallback if an unknown code sneaks in
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount) + ` ${currency}`;
    }
  };

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        merchantId,
        ...(siteId ? { siteId } : {}),
        limit: '25',
      });
      const res = await fetch(`/api/admin/orders/list?${qs.toString()}`, {
        credentials: 'include',
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || res.statusText);
      const list: Order[] = Array.isArray(data?.orders) ? data.orders : [];
      // ensure newest first if the API doesn't already
      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setOrders(list);
      setLastRefreshed(new Date());
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErr(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, siteId]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading
            ? 'Loading orders…'
            : err
            ? <span className="text-red-500">{err}</span>
            : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
          {lastRefreshed && !loading && !err && (
            <span className="ml-2">• refreshed {dtFmt.format(lastRefreshed)}</span>
          )}
        </div>
        <button
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {(!orders.length && !loading && !err) && (
        <div className="text-sm text-muted-foreground">No orders yet.</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="py-2.5 pl-4 pr-4">Created</th>
              <th className="py-2.5 pr-4">Order ID</th>
              <th className="py-2.5 pr-4">Amount</th>
              <th className="py-2.5 pr-4">Currency</th>
              <th className="py-2.5 pr-4">Status</th>
              <th className="py-2.5 pr-4">Provider Payment ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // simple skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border/40">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="py-2.5 pr-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-border/40 hover:bg-muted/40 transition-colors"
                >
                  <td className="py-2.5 pl-4 pr-4">
                    <time dateTime={o.created_at}>{dtFmt.format(new Date(o.created_at))}</time>
                  </td>
                  <td className="py-2.5 pr-4 font-mono">
                    <button
                      className="rounded px-1 hover:bg-muted"
                      title="Click to copy full ID"
                      onClick={() => copy(o.id)}
                    >
                      {o.id.slice(0, 8)}…
                    </button>
                  </td>
                  <td className="py-2.5 pr-4">{formatAmount(o.amount_cents, o.currency)}</td>
                  <td className="py-2.5 pr-4 uppercase">{(o.currency || 'USD').toUpperCase()}</td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-2.5 pr-4 font-mono">
                    {o.provider_payment_id ? (
                      <button
                        className="rounded px-1 hover:bg-muted"
                        title="Click to copy"
                        onClick={() => copy(o.provider_payment_id!)}
                      >
                        {o.provider_payment_id.slice(0, 10)}…
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const cls =
    s === 'paid'
      ? 'bg-emerald-100 text-emerald-700'
      : s === 'refunded'
      ? 'bg-amber-100 text-amber-700'
      : s === 'failed'
      ? 'bg-rose-100 text-rose-700'
      : s === 'pending'
      ? 'bg-slate-100 text-slate-700'
      : 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}
