// app/admin/go-live/page.tsx
// Live launch-readiness for the delivered.menu no-website funnel — the go-live runbook
// (docs/DELIVERED_MENU_GO_LIVE.md) as auto-detected state. Admin-gated.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { loadGoLiveChecklist, type CheckStatus } from '@/lib/menu/goLiveChecklist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ICON: Record<CheckStatus, string> = { ready: '✓', todo: '○', optional: '–', manual: '◇' };
const TONE: Record<CheckStatus, string> = {
  ready: 'text-emerald-400',
  todo: 'text-amber-400',
  optional: 'text-neutral-500',
  manual: 'text-sky-400',
};

export default async function GoLivePage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const { groups, readyRequired, totalRequired } = await loadGoLiveChecklist();
  const pct = totalRequired > 0 ? Math.round((readyRequired / totalRequired) * 100) : 0;
  const done = readyRequired === totalRequired;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Go-live readiness</h1>
          <p className="mt-1 text-sm text-neutral-400">
            delivered.menu no-website funnel. Full runbook: <code className="rounded bg-neutral-900 px-1 text-xs">docs/DELIVERED_MENU_GO_LIVE.md</code>
          </p>
        </div>
        <Link href="/admin/demand-funnel" className="shrink-0 text-sm text-sky-400 underline underline-offset-4 hover:text-sky-300">
          Demand funnel →
        </Link>
      </div>

      {/* progress */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className={done ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>
            {done ? '🚀 Required steps ready' : `${readyRequired}/${totalRequired} required steps ready`}
          </span>
          <span className="tabular-nums text-neutral-400">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* groups */}
      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-semibold text-neutral-300">{g.title}</h2>
            <div className="mt-2 divide-y divide-neutral-800 rounded-xl border border-neutral-800">
              {g.checks.map((c) => (
                <div key={c.key} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${TONE[c.status]}`}>{ICON[c.status]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-neutral-100">{c.label}</div>
                    {c.detail && <div className="text-xs text-neutral-500">{c.detail}</div>}
                  </div>
                  <span className={`shrink-0 text-[11px] uppercase tracking-wide ${TONE[c.status]}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-neutral-600">
        ✓ ready · ○ to-do (required) · ◇ manual (verify yourself) · – optional. SMS/claim-OTP stay off until you choose to enable them.
      </p>
    </div>
  );
}
