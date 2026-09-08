// lib/tradeSites/opsSnapshot.ts
//
// The operator's view of the trade-site pipeline, for the admin-only panel on /business-plan:
// what is queued, what the last nightly run did, what is waiting to be mailed, and which switches
// are on. Operational detail only — nothing here is a fact a reader would need to judge the
// business, which is the rule that keeps the operator panel honest (planHonesty.test.ts).
//
// SERVER ONLY (service role). Loaded by the page only when the viewer is an admin, so the public
// render pays for none of these queries.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pipelineEnabled, pipelineCaps, mailCaps, listQueue, type SweepQueueRow } from './pipeline';
import { tradeSiteBillingEnabled } from './config';
import { postcardMailEnabled, lobConfigured } from '@/lib/outreach/mail/lob';
import { selectMailableDrafts } from '@/lib/outreach/claimPostcardSend';

export type TradeOpsSnapshot = {
  flags: { pipeline: boolean; mail: boolean; billing: boolean; lob: boolean; postcardMail: boolean };
  caps: { maxSweeps: number; maxBuilds: number; maxMail: number; minAgeHours: number };
  queue: { queued: number; running: number; done: number; failed: number; next: SweepQueueRow[]; recent: SweepQueueRow[] };
  lastRun: { status: string | null; finishedAt: string | null; sweeps: number; noWebsiteFound: number; built: number; mailed: number; mailReason: string | null } | null;
  mail: { mailable: number; blocked: Record<string, number> };
};

export async function loadTradeOpsSnapshot(): Promise<TradeOpsSnapshot> {
  const [queue, runRes, drafts] = await Promise.all([
    listQueue(500).catch(() => [] as SweepQueueRow[]),
    (supabaseAdmin as any).from('cron_runs').select('*').eq('job', 'trade-site-pipeline').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    selectMailableDrafts({ limit: 200 }).catch(() => []),
  ]);
  const count = (s: SweepQueueRow['status']) => queue.filter((r) => r.status === s).length;
  const blocked: Record<string, number> = {};
  for (const d of drafts) if (d.blocked) blocked[d.blocked] = (blocked[d.blocked] ?? 0) + 1;
  const run = runRes?.data ?? null;
  const result = (run?.result ?? {}) as Record<string, any>;
  const caps = pipelineCaps();
  const m = mailCaps();
  return {
    flags: { pipeline: pipelineEnabled(), mail: m.enabled, billing: tradeSiteBillingEnabled(), lob: lobConfigured(), postcardMail: postcardMailEnabled() },
    caps: { maxSweeps: caps.maxSweeps, maxBuilds: caps.maxBuilds, maxMail: m.maxMail, minAgeHours: m.minAgeHours },
    queue: {
      queued: count('queued'),
      running: count('running'),
      done: count('done'),
      failed: count('failed'),
      next: queue.filter((r) => r.status === 'queued').sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at)).slice(0, 5),
      recent: queue.filter((r) => r.status === 'done' || r.status === 'failed').slice(0, 5),
    },
    lastRun: run
      ? {
          status: run.status ?? null,
          finishedAt: run.finished_at ?? null,
          sweeps: Number(result.sweeps ?? 0),
          noWebsiteFound: Number(result.noWebsiteFound ?? 0),
          built: Number(result.built ?? 0),
          mailed: Number(result.mailed ?? 0),
          mailReason: result.mailReason ?? (result.skipped ? String(result.skipped) : null),
        }
      : null,
    mail: { mailable: drafts.filter((d) => !d.blocked).length, blocked },
  };
}
