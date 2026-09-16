// app/api/admin/render-workers/route.ts
//
// "Is a worker alive, and what has the queue been doing?" — the admin view of the owner-run
// render tier (docs/RENDER_WORKERS.md). Read-only. Freshness is computed here from
// last_seen_at so a row left behind by a crashed worker reads as `stale`, not `alive`.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WORKER_FRESH_MS, renderWorkersEnabled } from '@/lib/jobs/renderQueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const now = Date.now();
  const [{ data: workers }, { data: jobs }, { data: counts }] = await Promise.all([
    supabaseAdmin.from('render_workers').select('*').order('last_seen_at', { ascending: false }),
    supabaseAdmin
      .from('render_jobs')
      .select('id, kind, url, status, claimed_by, requested_by, created_at, claimed_at, finished_at, error')
      .order('created_at', { ascending: false })
      .limit(25),
    supabaseAdmin
      .from('render_jobs')
      .select('status')
      .gte('created_at', new Date(now - 24 * 3600 * 1000).toISOString()),
  ]);

  const last24h: Record<string, number> = {};
  for (const r of (counts ?? []) as { status: string }[]) last24h[r.status] = (last24h[r.status] ?? 0) + 1;

  return NextResponse.json({
    enabled: renderWorkersEnabled(),
    workers: ((workers ?? []) as any[]).map((w) => ({
      ...w,
      alive: now - Date.parse(w.last_seen_at) <= WORKER_FRESH_MS,
    })),
    jobs: jobs ?? [],
    last24h,
  });
}
