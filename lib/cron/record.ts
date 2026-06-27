// lib/cron/record.ts
// Wrap a cron handler's work so each run is recorded in cron_runs (start, finish,
// status, duration, error, result) for the /admin/cron health dashboard.
import { createClient } from '@supabase/supabase-js';

function admin(): any {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function safeResult(r: any): any {
  try {
    if (r == null) return null;
    if (typeof r === 'object') return r;
    return { value: r };
  } catch {
    return null;
  }
}

/**
 * Record a cron run around `fn`. Logging never affects the job: if the cron_runs
 * insert/update fails it's swallowed, and fn's result/exception pass through.
 */
export async function withCronRun<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const db = admin();
  const start = Date.now();
  let runId: string | undefined;
  try {
    const { data } = await db.from('cron_runs').insert({ job, status: 'running' }).select('id').single();
    runId = data?.id;
  } catch {
    /* logging best-effort */
  }

  const finish = async (patch: Record<string, any>) => {
    if (!runId) return;
    try {
      await db.from('cron_runs').update({ finished_at: new Date().toISOString(), ...patch }).eq('id', runId);
    } catch {
      /* best-effort */
    }
  };

  try {
    const result = await fn();
    await finish({ ok: true, status: 'ok', duration_ms: Date.now() - start, result: safeResult(result) });
    return result;
  } catch (e: any) {
    await finish({ ok: false, status: 'error', duration_ms: Date.now() - start, error: String(e?.message || e).slice(0, 2000) });
    throw e;
  }
}

/**
 * Wrap a route handler that returns a Response. Records a cron run keyed to `job`,
 * deriving ok/error from the HTTP status (or a thrown error). Put the auth check
 * BEFORE this so unauthorized hits aren't logged as runs. Least-invasive way to
 * instrument an existing handler — its body is unchanged.
 */
export async function runCron(job: string, handler: () => Promise<Response>): Promise<Response> {
  const db = admin();
  const start = Date.now();
  let runId: string | undefined;
  try {
    const { data } = await db.from('cron_runs').insert({ job, status: 'running' }).select('id').single();
    runId = data?.id;
  } catch {
    /* best-effort */
  }

  const finish = async (patch: Record<string, any>) => {
    if (!runId) return;
    try {
      await db.from('cron_runs').update({ finished_at: new Date().toISOString(), ...patch }).eq('id', runId);
    } catch {
      /* best-effort */
    }
  };

  try {
    const res = await handler();
    const ok = res.status < 400;
    let result: any = { http_status: res.status };
    try {
      result = { http_status: res.status, ...(await res.clone().json()) };
    } catch {
      /* non-JSON body */
    }
    await finish({ ok, status: ok ? 'ok' : 'error', duration_ms: Date.now() - start, result });
    return res;
  } catch (e: any) {
    await finish({ ok: false, status: 'error', duration_ms: Date.now() - start, error: String(e?.message || e).slice(0, 2000) });
    throw e;
  }
}
