// lib/cron/registry.ts
// Canonical list of scheduled jobs powering /admin/cron. Mirror this with the
// `crons` array in vercel.json (vercel.json is what actually schedules them).

export type CronJob = {
  key: string; // matches cron_runs.job + the withCronRun(key) call
  path: string; // the route Vercel invokes
  schedule: string; // cron expression (mirror of vercel.json)
  intervalMinutes: number; // expected cadence — used for overdue detection
  label: string;
  description: string;
};

export const CRON_JOBS: CronJob[] = [
  {
    key: 'approve-commissions',
    path: '/api/cron/approve-commissions',
    schedule: '0 8 * * *',
    intervalMinutes: 1440,
    label: 'Approve partner commissions',
    description: 'Moves partner commissions pending → approved once past the refund window.',
  },
  {
    key: 'email-drain',
    path: '/api/cron/email-drain',
    schedule: '0 10 * * *',
    intervalMinutes: 1440,
    label: 'Email outbox drain',
    description: 'Sends queued emails from email_outbox.',
  },
  {
    key: 'compliance-reminders',
    path: '/api/cron/compliance-reminders',
    schedule: '0 9 * * *',
    intervalMinutes: 1440,
    label: 'Compliance reminders',
    description: 'Notifies merchants of upcoming / expiring compliance docs.',
  },
  {
    key: 'weekly-compliance-digest',
    path: '/api/cron/weekly-compliance-digest',
    schedule: '0 16 * * 1',
    intervalMinutes: 10080,
    label: 'Weekly compliance digest',
    description: 'Weekly compliance summary email.',
  },
  {
    key: 'expire-trials',
    path: '/api/admin/users/plan/expire-trials',
    schedule: '0 * * * *',
    intervalMinutes: 60,
    label: 'Expire trials',
    description: 'Expires user-plan trials that have ended.',
  },
  {
    key: 'ai-pricing-sync',
    path: '/api/admin/ai-pricing/sync/openai',
    schedule: '0 9 * * *',
    intervalMinutes: 1440,
    label: 'AI pricing sync (OpenAI)',
    description: 'Syncs OpenAI model pricing used by LLM cost logging.',
  },
];

export function jobByKey(key: string): CronJob | undefined {
  return CRON_JOBS.find((j) => j.key === key);
}

const pad = (s: string | number) => String(s).padStart(2, '0');

/** Friendly label for the cron expressions used in this project. */
export function humanSchedule(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [m, h, dom, mon, dow] = parts;
  if (dom === '*' && mon === '*' && dow === '*') {
    if (h === '*') return m === '0' ? 'Hourly' : `Hourly at :${pad(m)}`;
    return `Daily at ${pad(h)}:${pad(m)} UTC`;
  }
  if (dow !== '*' && dom === '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Weekly ${days[Number(dow)] ?? dow} at ${pad(h)}:${pad(m)} UTC`;
  }
  return expr;
}

export type Health = 'ok' | 'failed' | 'overdue' | 'running' | 'never';

export type LastRun = {
  status?: string | null;
  ok?: boolean | null;
  started_at?: string | null;
  finished_at?: string | null;
} | null;

/** Health from the most-recent run + the job's expected cadence. */
export function computeHealth(job: CronJob, lastRun: LastRun, now = Date.now()): Health {
  if (!lastRun) return 'never';
  if (lastRun.status === 'running') {
    const age = now - new Date(lastRun.started_at || 0).getTime();
    // a "running" row older than ~2× the interval is a stuck/crashed run
    return age > Math.max(job.intervalMinutes * 2, 30) * 60_000 ? 'failed' : 'running';
  }
  if (lastRun.ok === false || lastRun.status === 'error') return 'failed';
  const last = new Date(lastRun.finished_at || lastRun.started_at || 0).getTime();
  const overdueThreshold = job.intervalMinutes * 2 * 60_000 + 30 * 60_000; // 2× interval + 30m grace
  return now - last > overdueThreshold ? 'overdue' : 'ok';
}
