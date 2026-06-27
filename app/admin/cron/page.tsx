// app/admin/cron/page.tsx — single-pane health dashboard for all scheduled jobs.
// Joins the static CRON_JOBS registry (schedule + expected cadence) with the
// most-recent + recent rows from cron_runs, and derives a health badge per job.
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import {
  CRON_JOBS,
  computeHealth,
  humanSchedule,
  type Health,
} from '@/lib/cron/registry';

export const dynamic = 'force-dynamic';

type Run = {
  id: string;
  job: string;
  started_at: string | null;
  finished_at: string | null;
  ok: boolean | null;
  status: string | null;
  duration_ms: number | null;
  error: string | null;
};

const HEALTH_STYLES: Record<Health, { label: string; cls: string; dot: string }> = {
  ok: { label: 'Healthy', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  failed: { label: 'Failed', cls: 'text-red-300 bg-red-500/10 border-red-500/30', dot: 'bg-red-400' },
  overdue: { label: 'Overdue', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' },
  running: { label: 'Running', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30', dot: 'bg-sky-400 animate-pulse' },
  never: { label: 'No runs yet', cls: 'text-neutral-400 bg-neutral-500/10 border-neutral-700', dot: 'bg-neutral-500' },
};

function ago(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function dur(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function Badge({ health }: { health: Health }) {
  const s = HEALTH_STYLES[health];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default async function AdminCronPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-500">Admin access required.</div>;
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Pull a window of recent runs once, then bucket by job in memory.
  const { data: runsRaw } = await db
    .from('cron_runs')
    .select('id, job, started_at, finished_at, ok, status, duration_ms, error')
    .order('started_at', { ascending: false })
    .limit(300);
  const runs = (runsRaw as Run[] | null) ?? [];

  const byJob = new Map<string, Run[]>();
  for (const r of runs) {
    const list = byJob.get(r.job) ?? [];
    list.push(r);
    byJob.set(r.job, list);
  }

  const now = Date.now();
  const rows = CRON_JOBS.map((job) => {
    const history = byJob.get(job.key) ?? [];
    const last: Run | null = history[0] ?? null;
    return { job, last, history, health: computeHealth(job, last, now) };
  });

  // Surface jobs the DB has run but that aren't in the registry (drift detection).
  const known = new Set(CRON_JOBS.map((j) => j.key));
  const orphans = [...byJob.keys()].filter((k) => !known.has(k));

  const counts = rows.reduce<Record<Health, number>>(
    (acc, r) => ((acc[r.health] = (acc[r.health] ?? 0) + 1), acc),
    { ok: 0, failed: 0, overdue: 0, running: 0, never: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Cron health</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Every scheduled job in one place. Health is derived from the latest recorded run and the
        job&rsquo;s expected cadence (overdue = no success within 2× the interval).
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <span className="text-neutral-400">{CRON_JOBS.length} jobs:</span>
        {counts.failed ? <span className="text-red-300">{counts.failed} failed</span> : null}
        {counts.overdue ? <span className="text-amber-300">{counts.overdue} overdue</span> : null}
        {counts.running ? <span className="text-sky-300">{counts.running} running</span> : null}
        {counts.never ? <span className="text-neutral-400">{counts.never} never run</span> : null}
        {counts.ok ? <span className="text-emerald-300">{counts.ok} healthy</span> : null}
      </div>

      <div className="mt-6 space-y-3">
        {rows.map(({ job, last, history, health }) => (
          <div key={job.key} className="rounded-xl border border-neutral-800 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{job.label}</span>
                  <Badge health={health} />
                </div>
                <div className="mt-1 text-xs text-neutral-400">{job.description}</div>
                <div className="mt-1 font-mono text-xs text-neutral-500">{job.path}</div>
              </div>
              <div className="text-right text-xs text-neutral-400">
                <div>{humanSchedule(job.schedule)}</div>
                <div className="font-mono text-neutral-500">{job.schedule}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <span className="text-neutral-500">Last run</span>
                <div className="text-neutral-300">{ago(last?.started_at ?? null)}</div>
              </div>
              <div>
                <span className="text-neutral-500">Duration</span>
                <div className="text-neutral-300">{dur(last?.duration_ms ?? null)}</div>
              </div>
              <div>
                <span className="text-neutral-500">Outcome</span>
                <div className="text-neutral-300">{last?.status ?? '—'}</div>
              </div>
              <div>
                <span className="text-neutral-500">Recent</span>
                <div className="flex items-center gap-1 pt-0.5">
                  {history.slice(0, 12).map((r) => {
                    const color =
                      r.status === 'running'
                        ? 'bg-sky-400'
                        : r.ok === false || r.status === 'error'
                          ? 'bg-red-400'
                          : 'bg-emerald-400';
                    return (
                      <span
                        key={r.id}
                        title={`${r.started_at ?? ''} · ${r.status ?? ''}${r.error ? ` · ${r.error}` : ''}`}
                        className={`h-3 w-1.5 rounded-sm ${color}`}
                      />
                    );
                  })}
                  {history.length === 0 ? <span className="text-neutral-600">no history</span> : null}
                </div>
              </div>
            </div>

            {last?.status === 'error' && last?.error ? (
              <pre className="mt-3 overflow-x-auto rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-300">
                {last.error}
              </pre>
            ) : null}
          </div>
        ))}
      </div>

      {orphans.length ? (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="font-semibold text-amber-300">Unregistered jobs in run history</div>
          <p className="mt-1 text-xs text-neutral-400">
            These jobs have recorded runs but aren&rsquo;t in <span className="font-mono">lib/cron/registry.ts</span>.
            Add them so they&rsquo;re monitored: {orphans.map((o) => <span key={o} className="font-mono">{o} </span>)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
