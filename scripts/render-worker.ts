// scripts/render-worker.ts
//
// The owner-run render worker. Runs on a Mac mini (or any box with Node 20 + a Playwright
// Chromium), claims `render_jobs` from Supabase, renders them with the SAME page-side scripts
// the Vercel functions use, and writes the result back. Vercel keeps rendering for itself
// whenever this is not alive (lib/jobs/renderQueue.ts), so stopping it costs nothing but speed.
//
//   npm run render:worker            # RENDER_WORKER_ID defaults to the hostname
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (the key is full DB
// access — treat the machine as a server, not a laptop). Setup + launchd: docs/RENDER_WORKERS.md.
//
// ⚠️ SECURITY. (1) The job row carries a URL and options, never code: the script is chosen from
// JS_BY_KIND below, so a tampered row cannot execute arbitrary JavaScript here. (2) Every URL
// passes assertPublicHttpUrl() before Chromium sees it — the same SSRF guard as the serverless
// path — so a job cannot make this machine browse the owner's LAN (192.168.x, printers, NAS).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import os from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { renderEvaluate, type WaitUntil } from '@/lib/verify/render';
import { EXTRACT_JS } from '@/lib/verify/extract';
import { CATALOG_EXTRACT_JS } from '@/lib/rebuild/renderedCatalog';
import { assertPublicHttpUrl } from '@/lib/rebuild/scrapeSite';

const JS_BY_KIND: Record<string, string> = {
  catalog: CATALOG_EXTRACT_JS,
  verify: EXTRACT_JS,
};
const KINDS = Object.keys(JS_BY_KIND);

const WORKER_ID = process.env.RENDER_WORKER_ID || os.hostname().replace(/\.local$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.RENDER_WORKER_CONCURRENCY || 2));
const HEARTBEAT_MS = 10_000;
const IDLE_POLL_MS = 1_000;
const VERSION = process.env.RENDER_WORKER_VERSION || 'dev';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('[render-worker] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let busy = 0;
let stopping = false;
const log = (msg: string, extra?: unknown) =>
  console.log(`[render-worker ${WORKER_ID}] ${new Date().toISOString()} ${msg}`, extra ?? '');

async function heartbeat() {
  const { error } = await db.from('render_workers').upsert(
    {
      worker_id: WORKER_ID,
      hostname: os.hostname(),
      capabilities: KINDS,
      version: VERSION,
      busy,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'worker_id' },
  );
  if (error) log('heartbeat failed', error.message);
}

async function claim(): Promise<any | null> {
  const { data, error } = await db.rpc('claim_render_job', { p_worker_id: WORKER_ID, p_kinds: KINDS });
  if (error) {
    log('claim failed', error.message);
    return null;
  }
  // The RPC returns a composite; an unclaimed call yields a row with a null id.
  return data && (data as any).id ? data : null;
}

async function run(job: any) {
  busy++;
  const started = Date.now();
  try {
    const js = JS_BY_KIND[job.kind];
    if (!js) throw new Error(`unknown kind ${job.kind}`);
    const target = assertPublicHttpUrl(String(job.url)); // SSRF guard, same as serverless
    const o = (job.options ?? {}) as { timeoutMs?: number | null; waitUntil?: WaitUntil | null };
    const r = await renderEvaluate<unknown>(target.toString(), js, {
      prefer: 'playwright',
      timeoutMs: o.timeoutMs ?? 25_000,
      waitUntil: o.waitUntil ?? 'networkidle',
    });
    if (!r.ok) throw new Error(r.error);
    await db
      .from('render_jobs')
      .update({ status: 'done', result: r.value as any, finished_at: new Date().toISOString() })
      .eq('id', job.id);
    log(`done ${job.kind} ${job.url} in ${Date.now() - started}ms`);
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 2000);
    await db
      .from('render_jobs')
      .update({ status: 'failed', error: msg, finished_at: new Date().toISOString() })
      .eq('id', job.id);
    log(`FAILED ${job.kind} ${job.url}: ${msg}`);
  } finally {
    busy--;
  }
}

async function main() {
  log(`starting: kinds=${KINDS.join(',')} concurrency=${CONCURRENCY}`);
  await heartbeat();
  const hb = setInterval(() => void heartbeat(), HEARTBEAT_MS);
  const stop = () => {
    if (stopping) return;
    stopping = true;
    log('stopping — finishing in-flight jobs');
    clearInterval(hb);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    if (busy >= CONCURRENCY) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    const job = await claim();
    if (!job) {
      await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
      continue;
    }
    void run(job);
  }
  while (busy > 0) await new Promise((r) => setTimeout(r, 200));
  await db.from('render_workers').delete().eq('worker_id', WORKER_ID);
  log('stopped');
  process.exit(0);
}

void main();
