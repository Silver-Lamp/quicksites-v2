// app/api/cron/domain-watch/route.ts
//
// Daily: check every watched domain (lib/domains/watchlist.ts) and buy it the day it becomes
// registerable at or under its cap. Everything else files an owner task + emails ADMIN_EMAILS.
// Registered in vercel.json. Cron-secret auth'd; runCron records the run.

import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { runDomainWatch, defaultWatchDeps } from '@/lib/domains/watchlist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('domain-watch', async () => {
    const report = await runDomainWatch(defaultWatchDeps());
    return NextResponse.json({ ok: true, ...report });
  });
}

export const GET = handle;
export const POST = handle;
