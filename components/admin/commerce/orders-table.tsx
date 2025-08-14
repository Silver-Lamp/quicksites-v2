'use client';

import { useEffect, useState } from 'react';

type Order = {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'pending'|'paid'|'refunded'|'failed'|string;
  provider_payment_id: string | null;
  created_at: string;
};

export default function OrdersTable({ merchantId, siteId }: { merchantId: string; siteId?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ merchantId, ...(siteId ? { siteId } : {}), limit: '25' });
      const r = await fetch(`/api/admin/orders/list?${qs.toString()}`);
      const data = await r.json();
      setOrders(data?.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [merchantId, siteId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!orders.length) return <div className="text-sm text-muted-foreground">No orders yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">Order ID</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Currency</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Provider Payment ID</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} className="border-t">
              <td className="py-2 pr-4">{new Date(o.created_at).toLocaleString()}</td>
              <td className="py-2 pr-4 font-mono">{o.id.slice(0,8)}…</td>
              <td className="py-2 pr-4">${(o.amount_cents/100).toFixed(2)}</td>
              <td className="py-2 pr-4 uppercase">{o.currency}</td>
              <td className="py-2 pr-4">
                <span className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs',
                  o.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  o.status === 'refunded' ? 'bg-amber-100 text-amber-700' :
                  o.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                  'bg-slate-100 text-slate-700'
                ].join(' ')}>
                  {o.status}
                </span>
              </td>
              <td className="py-2 pr-4 font-mono">{o.provider_payment_id ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
