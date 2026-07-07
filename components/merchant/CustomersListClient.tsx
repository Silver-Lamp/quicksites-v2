'use client';

// Merchant customer list (CRM_PLAN.md Phase 1). Searchable by name/email/phone,
// client-side (customer counts per merchant are modest). Each row links to the
// customer profile with order history + LTV.

import * as React from 'react';
import Link from 'next/link';

export type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  orders_count: number;
  lifetime_cents: number;
  first_order_at: string | null;
  last_order_at: string | null;
  marketing_consent: boolean;
};

function fmtCents(c: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((c || 0) / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function CustomersListClient({
  rows,
  merchantId,
  totalLtv,
}: {
  rows: CustomerRow[];
  merchantId: string;
  totalLtv: number;
}) {
  const [q, setQ] = React.useState('');

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      (r.name || '').toLowerCase().includes(needle) ||
      r.email.toLowerCase().includes(needle) ||
      (r.phone || '').toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, or phone…"
          className="w-72 rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-neutral-600"
        />
        <div className="text-neutral-400">
          <span className="text-neutral-200">{rows.length}</span> {rows.length === 1 ? 'customer' : 'customers'}
          <span className="mx-2 text-neutral-600">•</span>
          <span className="text-neutral-200">{fmtCents(totalLtv)}</span> lifetime
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-neutral-400">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2 text-right">Orders</th>
              <th className="px-4 py-2 text-right">Lifetime</th>
              <th className="px-4 py-2">Last order</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  {rows.length === 0 ? 'No customers yet — they appear here once an order is paid.' : 'No matches.'}
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link
                    href={`/merchant/customers/${r.id}?merchant=${merchantId}`}
                    className="font-medium text-white hover:underline"
                  >
                    {r.name || r.email.split('@')[0]}
                  </Link>
                  {r.marketing_consent && (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">opted in</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  <div>{r.email}</div>
                  {r.phone && <div className="text-xs text-neutral-500">{r.phone}</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.orders_count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtCents(r.lifetime_cents)}</td>
                <td className="px-4 py-3 text-neutral-400">{fmtDate(r.last_order_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
