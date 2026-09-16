// lib/jobs/renderQueue.ts
//
// Route a headless-browser render to an owner-run worker (a Mac mini) when one is alive, else
// run it here. The queue is an OPTIMISATION WITH A HARD FALLBACK, never a dependency:
//
//   • no worker heartbeat in the last WORKER_FRESH_MS   → render locally, as before
//   • job not claimed within CLAIM_TIMEOUT_MS            → expire it, render locally
//   • worker reports failure, or the deadline passes     → render locally
//
// so a home box going dark degrades to today's behaviour, not to an outage.
//
// The job row carries a URL and options — never JavaScript. Workers select a FIXED script by
// `kind` (scripts/render-worker.ts), and apply the same public-URL guard as every fetch in
// lib/rebuild, so a row cannot make a worker browse the owner's LAN.
//
// Pure decision + polling logic takes its I/O through `deps` and is unit-tested with fakes;
// the default deps use the service-role client.

import type { EvaluateResult, WaitUntil } from '@/lib/verify/render';

export type RenderJobKind = 'catalog' | 'verify';

export type RenderWorkerRow = {
  worker_id: string;
  capabilities: string[];
  last_seen_at: string;
  busy?: number;
};

export type RenderJobRow = {
  id: string;
  status: 'queued' | 'claimed' | 'done' | 'failed' | 'expired';
  result: unknown;
  error: string | null;
  claimed_by: string | null;
};

export type RenderQueueDeps = {
  listWorkers: () => Promise<RenderWorkerRow[]>;
  insertJob: (job: {
    kind: RenderJobKind;
    url: string;
    options: Record<string, unknown>;
    expires_at: string;
    requested_by?: string;
  }) => Promise<string>;
  getJob: (id: string) => Promise<RenderJobRow | null>;
  expireJob: (id: string) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** Opt-in: no worker exists until the owner runs one, so this is OFF unless set. */
export function renderWorkersEnabled(): boolean {
  const v = String(process.env.RENDER_WORKERS_ENABLED ?? '').toLowerCase();
  return v === '1' || v === 'true';
}

export const WORKER_FRESH_MS = 30_000;
export const CLAIM_TIMEOUT_MS = 6_000;
export const POLL_MS = 500;

/** A worker that heartbeated recently and advertises this kind. Pure. */
export function pickFreshWorker(
  workers: RenderWorkerRow[],
  kind: RenderJobKind,
  nowMs: number,
  freshMs = WORKER_FRESH_MS,
): RenderWorkerRow | null {
  const fresh = workers.filter((w) => {
    const seen = Date.parse(w.last_seen_at);
    return Number.isFinite(seen) && nowMs - seen <= freshMs && (w.capabilities ?? []).includes(kind);
  });
  if (!fresh.length) return null;
  // Least busy first, then most recently seen.
  fresh.sort((a, b) => (a.busy ?? 0) - (b.busy ?? 0) || Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  return fresh[0];
}

export type QueuedRenderOpts = {
  timeoutMs?: number;
  waitUntil?: WaitUntil;
  requestedBy?: string;
};

/**
 * Try a worker; fall back to `local` on every path that does not end in a worker result.
 * `local` is the exact render this process would have done without a queue.
 */
export async function renderViaQueue<T>(
  kind: RenderJobKind,
  url: string,
  opts: QueuedRenderOpts,
  local: () => Promise<EvaluateResult<T>>,
  deps: RenderQueueDeps,
  enabled: boolean = renderWorkersEnabled(),
): Promise<EvaluateResult<T> & { via: 'worker' | 'local'; reason?: string }> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const fallback = async (reason: string) => ({ ...(await local()), via: 'local' as const, reason });

  if (!enabled) return fallback('disabled');

  let worker: RenderWorkerRow | null = null;
  try {
    worker = pickFreshWorker(await deps.listWorkers(), kind, now());
  } catch (e: any) {
    return fallback(`workers_unreadable:${String(e?.message ?? e)}`);
  }
  if (!worker) return fallback('no_fresh_worker');

  const budgetMs = Math.max(5_000, opts.timeoutMs ?? 30_000);
  const startedAt = now();
  let jobId: string;
  try {
    jobId = await deps.insertJob({
      kind,
      url,
      options: { timeoutMs: opts.timeoutMs ?? null, waitUntil: opts.waitUntil ?? null },
      expires_at: new Date(startedAt + budgetMs).toISOString(),
      requested_by: opts.requestedBy,
    });
  } catch (e: any) {
    return fallback(`enqueue_failed:${String(e?.message ?? e)}`);
  }

  let claimed = false;
  for (;;) {
    await sleep(POLL_MS);
    const elapsed = now() - startedAt;
    let job: RenderJobRow | null = null;
    try {
      job = await deps.getJob(jobId);
    } catch {
      /* transient read failure — keep polling until the deadline */
    }
    if (job?.status === 'done') {
      return { ok: true, value: job.result as T, driver: 'worker', via: 'worker' };
    }
    if (job?.status === 'failed' || job?.status === 'expired') {
      return fallback(`worker_${job.status}:${job.error ?? ''}`);
    }
    if (job?.status === 'claimed') claimed = true;
    if (!claimed && elapsed >= CLAIM_TIMEOUT_MS) {
      await deps.expireJob(jobId).catch(() => {});
      return fallback('not_claimed');
    }
    if (elapsed >= budgetMs) {
      await deps.expireJob(jobId).catch(() => {});
      return fallback('deadline');
    }
  }
}

/* ---------- default deps (service role) ---------- */

export function defaultRenderQueueDeps(): RenderQueueDeps {
  // Lazy (dynamic) import keeps this module importable in tests without env — the admin client
  // constructs itself at import time and throws without a URL. ⚠️ Not `require`: under tsx/ESM
  // (the worker, local scripts) `require` of a path alias throws, which silently sent every
  // render down the "workers_unreadable" fallback on the first end-to-end run.
  const client = async () => (await import('@/lib/supabase/admin')).supabaseAdmin;
  return {
    async listWorkers() {
      const { data, error } = await (await client())
        .from('render_workers')
        .select('worker_id, capabilities, last_seen_at, busy')
        .gte('last_seen_at', new Date(Date.now() - WORKER_FRESH_MS * 2).toISOString());
      if (error) throw error;
      return (data ?? []) as RenderWorkerRow[];
    },
    async insertJob(job) {
      const { data, error } = await (await client()).from('render_jobs').insert(job).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    async getJob(id) {
      const { data, error } = await (await client())
        .from('render_jobs')
        .select('id, status, result, error, claimed_by')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RenderJobRow | null;
    },
    async expireJob(id) {
      // Only an unclaimed job is expired here; a claimed one is the worker's to finish.
      await (await client()).from('render_jobs').update({ status: 'expired' }).eq('id', id).eq('status', 'queued');
    },
  };
}
