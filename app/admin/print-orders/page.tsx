// app/admin/print-orders/page.tsx
// Print-on-demand fulfillment dashboard — Lulu/Gelato print jobs from print_orders.

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { adminUserId } from '@/lib/auth/adminUser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = {
  id: string;
  order_id: string | null;
  provider: string;
  provider_job_id: string | null;
  status: string;
  cost_cents: number | null;
  created_at: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  shipped: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-emerald-500/20 text-emerald-300',
  error: 'bg-red-500/20 text-red-300',
  rejected: 'bg-red-500/20 text-red-300',
  awaiting_address: 'bg-amber-500/20 text-amber-300',
  awaiting_fulfillment: 'bg-amber-500/20 text-amber-300',
  pending: 'bg-zinc-700/60 text-zinc-300',
};
function badge(status: string) {
  const key = (status || '').toLowerCase();
  return STATUS_STYLE[key] || 'bg-sky-500/15 text-sky-300';
}
const money = (c?: number | null) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);

export default async function PrintOrdersPage() {
  const admin = await adminUserId();
  if (!admin) return <div className="mx-auto max-w-6xl p-6 mt-12 text-sm text-zinc-400">Admins only.</div>;

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await db
    .from('print_orders')
    .select('id, order_id, provider, provider_job_id, status, cost_cents, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Row[];

  const podOn = process.env.POD_ENABLED === 'true';
  const byStatus = rows.reduce((m, r) => {
    const k = (r.status || 'pending').toLowerCase();
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-6xl p-6 mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Print orders</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Lulu / Gelato fulfillment ({rows.length} recent).{' '}
            <span className={podOn ? 'text-emerald-400' : 'text-amber-400'}>
              POD {podOn ? 'enabled' : 'disabled'}
            </span>
          </p>
        </div>
        <Link href="/admin/cron" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">Cron runs</Link>
      </div>

      {Object.keys(byStatus).length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge(s)}`}>
              {s} · {n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">When</th>
              <th className="px-4">Provider</th>
              <th className="px-4">Status</th>
              <th className="px-4">Order</th>
              <th className="px-4">Job</th>
              <th className="px-4 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800/60">
                <td className="px-4 py-2.5 text-zinc-400">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                <td className="px-4 capitalize">{r.provider}</td>
                <td className="px-4"><span className={`rounded-full px-2 py-0.5 text-xs ${badge(r.status)}`}>{r.status}</span></td>
                <td className="px-4 font-mono text-xs text-zinc-500">{r.order_id ? r.order_id.slice(0, 8) : '—'}</td>
                <td className="px-4 font-mono text-xs text-zinc-500">{r.provider_job_id || '—'}</td>
                <td className="px-4 text-right tabular-nums">{money(r.cost_cents)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No print orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
