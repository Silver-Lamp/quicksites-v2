// app/admin/ai-costs/page.tsx
// In-app AI spend dashboard: totals + breakdown by model and route (so demo-gen
// and cron-triggered LLM spend is visible) from ai_usage_events. Admin-only.

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { adminUserId } from '@/lib/auth/adminUser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const money = (n: number) => `$${(n || 0).toFixed(n >= 1 ? 2 : 4)}`;

type Row = { cost_usd: number | null; model_code: string | null; modality: string | null; occurred_at: string | null; metadata: any };

export default async function AiCostsPage() {
  const admin = await adminUserId();
  if (!admin) {
    return <div className="mx-auto max-w-6xl p-6 mt-12 text-sm text-zinc-400">Admins only.</div>;
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await db
    .from('ai_usage_events')
    .select('cost_usd, model_code, modality, occurred_at, metadata')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(5000);

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const sum = (rs: Row[]) => rs.reduce((a, r) => a + Number(r.cost_usd || 0), 0);
  const within = (ms: number) => rows.filter((r) => r.occurred_at && now - new Date(r.occurred_at).getTime() <= ms);
  const today = within(86_400_000);
  const d7 = within(7 * 86_400_000);

  const byKey = (fn: (r: Row) => string | null | undefined) => {
    const m = new Map<string, { cost: number; count: number }>();
    for (const r of rows) {
      const k = fn(r) || '—';
      const e = m.get(k) || { cost: 0, count: 0 };
      e.cost += Number(r.cost_usd || 0);
      e.count += 1;
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  };
  const byModel = byKey((r) => r.model_code);
  const byRoute = byKey((r) => r.metadata?.route);

  const Stat = ({ label, cost, count }: { label: string; cost: number; count: number }) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{money(cost)}</div>
      <div className="text-xs text-zinc-500">{count} call{count === 1 ? '' : 's'}</div>
    </div>
  );

  const Table = ({ title, rows: rs }: { title: string; rows: [string, { cost: number; count: number }][] }) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 space-y-1.5">
        {rs.length === 0 && <div className="text-xs text-zinc-500">No usage in the last 30 days.</div>}
        {rs.slice(0, 12).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-zinc-300">{k}</span>
            <span className="shrink-0 tabular-nums text-zinc-400">
              {money(v.cost)} <span className="text-zinc-600">· {v.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl p-6 mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI spend</h1>
          <p className="mt-1 text-sm text-zinc-400">Metered LLM usage (last 30 days), from <code className="text-zinc-300">ai_usage_events</code>.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/cron" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800">Cron runs</Link>
          <Link href="/admin/settings/ai-pricing" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800">AI pricing</Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Today" cost={sum(today)} count={today.length} />
        <Stat label="Last 7 days" cost={sum(d7)} count={d7.length} />
        <Stat label="Last 30 days" cost={sum(rows)} count={rows.length} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Table title="By model" rows={byModel} />
        <Table title="By route" rows={byRoute} />
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h3 className="text-sm font-semibold text-white">Recent calls</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="py-1.5 pr-4">When</th><th className="pr-4">Model</th><th className="pr-4">Modality</th><th className="pr-4">Route</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody className="text-zinc-300">
              {rows.slice(0, 25).map((r, i) => (
                <tr key={i} className="border-t border-zinc-800/60">
                  <td className="py-1.5 pr-4 text-zinc-400">{r.occurred_at ? new Date(r.occurred_at).toLocaleString() : '—'}</td>
                  <td className="pr-4">{r.model_code || '—'}</td>
                  <td className="pr-4 text-zinc-400">{r.modality || '—'}</td>
                  <td className="pr-4 text-zinc-400">{r.metadata?.route || '—'}</td>
                  <td className="text-right tabular-nums">{money(Number(r.cost_usd || 0))}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-zinc-500">No metered AI usage yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          In-app figures are estimates from the pricing table; OpenAI’s dashboard is the source of truth. Image costs require a
          priced <code className="text-zinc-400">image</code> row per model (gpt-image-1 is configured).
        </p>
      </div>
    </div>
  );
}
