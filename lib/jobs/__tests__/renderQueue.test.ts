/**
 * @jest-environment node
 */
// lib/jobs/__tests__/renderQueue.test.ts
//
// The queue is an optimisation with a HARD fallback. Every path that does not end in a worker
// result must end in the local render — the same one the process would have done without a
// queue. A home machine going dark degrades to today, never to an outage.

import {
  pickFreshWorker,
  renderViaQueue,
  renderWorkersEnabled,
  CLAIM_TIMEOUT_MS,
  type RenderQueueDeps,
  type RenderJobRow,
  type RenderWorkerRow,
} from '@/lib/jobs/renderQueue';

const T0 = Date.parse('2026-09-16T16:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('pickFreshWorker', () => {
  const workers: RenderWorkerRow[] = [
    { worker_id: 'mini-1', capabilities: ['catalog', 'verify'], last_seen_at: iso(T0 - 5_000), busy: 1 },
    { worker_id: 'mini-2', capabilities: ['catalog'], last_seen_at: iso(T0 - 8_000), busy: 0 },
    { worker_id: 'dead', capabilities: ['catalog'], last_seen_at: iso(T0 - 120_000), busy: 0 },
  ];
  it('prefers the least busy fresh worker with the capability', () => {
    expect(pickFreshWorker(workers, 'catalog', T0)?.worker_id).toBe('mini-2');
  });
  it('ignores a worker whose heartbeat is stale', () => {
    expect(pickFreshWorker([workers[2]], 'catalog', T0)).toBeNull();
  });
  it('ignores a worker that does not advertise the kind', () => {
    expect(pickFreshWorker([workers[1]], 'verify', T0)).toBeNull();
  });
});

/** Fake deps with a scripted job lifecycle. `states` is what getJob returns on each poll. */
function fakeDeps(opts: { workers?: RenderWorkerRow[]; states?: Partial<RenderJobRow>[]; insertFails?: boolean }) {
  let t = T0;
  const calls = { insert: 0, expire: 0, polls: 0 };
  const states = opts.states ?? [];
  const deps: RenderQueueDeps = {
    listWorkers: async () => opts.workers ?? [{ worker_id: 'mini-1', capabilities: ['catalog'], last_seen_at: iso(T0 - 1_000), busy: 0 }],
    insertJob: async () => {
      calls.insert++;
      if (opts.insertFails) throw new Error('insert boom');
      return 'job-1';
    },
    getJob: async () => {
      const s = states[Math.min(calls.polls, states.length - 1)] ?? { status: 'queued' };
      calls.polls++;
      return { id: 'job-1', status: 'queued', result: null, error: null, claimed_by: null, ...s } as RenderJobRow;
    },
    expireJob: async () => {
      calls.expire++;
    },
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
  };
  return { deps, calls };
}

const local = jest.fn(async () => ({ ok: true as const, value: { from: 'local' }, driver: 'serverless' as const }));
beforeEach(() => local.mockClear());

describe('renderViaQueue', () => {
  it('returns the worker result when the job completes', async () => {
    const { deps, calls } = fakeDeps({
      states: [{ status: 'claimed', claimed_by: 'mini-1' }, { status: 'done', result: { from: 'worker' } }],
    });
    const r = await renderViaQueue('catalog', 'https://x.example/', {}, local, deps, true);
    expect(r).toMatchObject({ ok: true, via: 'worker', driver: 'worker', value: { from: 'worker' } });
    expect(local).not.toHaveBeenCalled();
    expect(calls.expire).toBe(0);
  });

  it('falls back locally when disabled, without touching the queue', async () => {
    const { deps, calls } = fakeDeps({});
    const r = await renderViaQueue('catalog', 'https://x.example/', {}, local, deps, false);
    expect(r).toMatchObject({ via: 'local', reason: 'disabled', value: { from: 'local' } });
    expect(calls.insert).toBe(0);
  });

  it('falls back locally when no worker has a fresh heartbeat', async () => {
    const { deps, calls } = fakeDeps({ workers: [{ worker_id: 'dead', capabilities: ['catalog'], last_seen_at: iso(T0 - 90_000) }] });
    const r = await renderViaQueue('catalog', 'https://x.example/', {}, local, deps, true);
    expect(r).toMatchObject({ via: 'local', reason: 'no_fresh_worker' });
    expect(calls.insert).toBe(0);
  });

  it('expires an unclaimed job after the claim timeout and falls back locally', async () => {
    const { deps, calls } = fakeDeps({ states: [{ status: 'queued' }] });
    const r = await renderViaQueue('catalog', 'https://x.example/', { timeoutMs: 30_000 }, local, deps, true);
    expect(r).toMatchObject({ via: 'local', reason: 'not_claimed' });
    expect(calls.expire).toBe(1);
    expect(calls.polls * 500).toBeGreaterThanOrEqual(CLAIM_TIMEOUT_MS);
  });

  it('falls back locally when the worker reports failure, and does not expire a claimed job', async () => {
    const { deps, calls } = fakeDeps({ states: [{ status: 'claimed' }, { status: 'failed', error: 'chromium died' }] });
    const r = await renderViaQueue('catalog', 'https://x.example/', {}, local, deps, true);
    expect(r).toMatchObject({ via: 'local', reason: 'worker_failed:chromium died' });
    expect(calls.expire).toBe(0);
  });

  it('falls back locally at the deadline even if the worker is still working', async () => {
    const { deps } = fakeDeps({ states: [{ status: 'claimed' }] });
    const r = await renderViaQueue('catalog', 'https://x.example/', { timeoutMs: 8_000 }, local, deps, true);
    expect(r).toMatchObject({ via: 'local', reason: 'deadline' });
  });

  it('falls back locally when the enqueue itself fails', async () => {
    const { deps } = fakeDeps({ insertFails: true });
    const r = await renderViaQueue('catalog', 'https://x.example/', {}, local, deps, true);
    expect(r.via).toBe('local');
    expect(r.reason).toMatch(/^enqueue_failed/);
  });

  it('is OFF unless RENDER_WORKERS_ENABLED is explicitly set', () => {
    const prev = process.env.RENDER_WORKERS_ENABLED;
    delete process.env.RENDER_WORKERS_ENABLED;
    expect(renderWorkersEnabled()).toBe(false);
    process.env.RENDER_WORKERS_ENABLED = '1';
    expect(renderWorkersEnabled()).toBe(true);
    if (prev === undefined) delete process.env.RENDER_WORKERS_ENABLED;
    else process.env.RENDER_WORKERS_ENABLED = prev;
  });
});

describe('the worker never executes code from a job row', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'scripts/render-worker.ts'), 'utf8');
  it('selects the script from a fixed map keyed by kind', () => {
    expect(src).toMatch(/const JS_BY_KIND: Record<string, string> = \{/);
    expect(src).toMatch(/JS_BY_KIND\[job\.kind\]/);
    expect(src).not.toMatch(/job\.(js|script|code)/);
  });
  it('applies the public-URL (SSRF) guard before rendering', () => {
    const at = src.indexOf('renderEvaluate<unknown>(');
    expect(src.slice(0, at)).toContain('assertPublicHttpUrl(String(job.url))');
  });
});
