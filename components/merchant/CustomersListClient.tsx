'use client';

// Merchant customer list (CRM_PLAN.md Phase 1 + Phase 2 segments). Search by
// name/email/phone, filter by segment (opted-in / repeat / recent / lapsed) and
// tag, and sort — all client-side (customer counts per merchant are modest). Each
// row links to the customer profile with order history + LTV.

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
  tags: string[];
};

const RECENT_DAYS = 30;   // "Recent" = ordered within this window
const LAPSED_DAYS = 90;   // "Lapsed" = has ordered, but not within this window

type Segment = 'all' | 'opted_in' | 'repeat' | 'recent' | 'lapsed';
type SortKey = 'recent' | 'ltv' | 'orders' | 'name';

function fmtCents(c: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((c || 0) / 100);
}
function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms < 0 ? 0 : Math.floor(ms / 86_400_000);
}

function matchesSegment(r: CustomerRow, seg: Segment): boolean {
  switch (seg) {
    case 'opted_in': return r.marketing_consent;
    case 'repeat': return (r.orders_count || 0) >= 2;
    case 'recent': {
      const d = daysSince(r.last_order_at);
      return d !== null && d <= RECENT_DAYS;
    }
    case 'lapsed': {
      const d = daysSince(r.last_order_at);
      return d !== null && d > LAPSED_DAYS;
    }
    default: return true;
  }
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
  const [seg, setSeg] = React.useState<Segment>('all');
  const [tag, setTag] = React.useState('');
  const [sort, setSort] = React.useState<SortKey>('recent');

  // All tags present, for the tag filter.
  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) for (const t of r.tags || []) s.add(t);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Segment counts (independent of search/tag), like the inventory tabs.
  const counts = React.useMemo(() => ({
    all: rows.length,
    opted_in: rows.filter((r) => matchesSegment(r, 'opted_in')).length,
    repeat: rows.filter((r) => matchesSegment(r, 'repeat')).length,
    recent: rows.filter((r) => matchesSegment(r, 'recent')).length,
    lapsed: rows.filter((r) => matchesSegment(r, 'lapsed')).length,
  }), [rows]);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (!matchesSegment(r, seg)) return false;
      if (tag && !(r.tags || []).includes(tag)) return false;
      if (needle) {
        const hay = `${r.name || ''} ${r.email} ${r.phone || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const by: Record<SortKey, (a: CustomerRow, b: CustomerRow) => number> = {
      recent: (a, b) => (new Date(b.last_order_at || 0).getTime()) - (new Date(a.last_order_at || 0).getTime()),
      ltv: (a, b) => (b.lifetime_cents || 0) - (a.lifetime_cents || 0),
      orders: (a, b) => (b.orders_count || 0) - (a.orders_count || 0),
      name: (a, b) => (a.name || a.email).localeCompare(b.name || b.email),
    };
    return [...out].sort(by[sort]);
  }, [rows, q, seg, tag, sort]);

  const shownLtv = React.useMemo(() => shown.reduce((s, r) => s + (r.lifetime_cents || 0), 0), [shown]);
  const filtered = seg !== 'all' || !!tag || !!q.trim();

  const tabs: { key: Segment; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'opted_in', label: 'Opted in', n: counts.opted_in },
    { key: 'repeat', label: 'Repeat', n: counts.repeat },
    { key: 'recent', label: `Recent (${RECENT_DAYS}d)`, n: counts.recent },
    { key: 'lapsed', label: `Lapsed (${LAPSED_DAYS}d+)`, n: counts.lapsed },
  ];

  return (
    <div>
      {/* Segment chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSeg(t.key)}
            className={`rounded-full border px-3 py-1 ${
              seg === t.key ? 'border-white/40 bg-white/10' : 'border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            {t.label} <span className="text-neutral-500">({t.n})</span>
          </button>
        ))}
      </div>

      {/* Search + tag + sort */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, or phone…"
          className="w-64 rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-neutral-600"
        />
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-neutral-600"
          >
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-neutral-600"
          aria-label="Sort by"
        >
          <option value="recent">Sort: Last order</option>
          <option value="ltv">Sort: Lifetime value</option>
          <option value="orders">Sort: Orders</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="ml-auto text-neutral-400">
          <span className="text-neutral-200">{shown.length}</span>
          {filtered ? ` of ${rows.length}` : rows.length === 1 ? ' customer' : ' customers'}
          <span className="mx-2 text-neutral-600">•</span>
          <span className="text-neutral-200">{fmtCents(filtered ? shownLtv : totalLtv)}</span> {filtered ? 'shown' : 'lifetime'}
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
                  {(r.tags || []).length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300">{t}</span>
                      ))}
                    </div>
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
