// app/api/cron/seo-coach-daily/route.ts
//
// Daily "next best step" SEO coaching email for paid, opted-in site owners. Cron-authorized;
// no-op unless AI_SEO_COACH_ENABLED. Queues into email_outbox (email-drain sends). Idempotent
// per UTC day. See docs/AI_SEO_COACHING.md.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { aiSeoCoachEnabled } from '@/lib/seo/coach/flags';
import { runSeoCoach } from '@/lib/seo/coach/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('seo-coach-daily', async () => {
    if (!aiSeoCoachEnabled()) return NextResponse.json({ ok: true, disabled: true });
    const result = await runSeoCoach(admin, 'daily');
    return NextResponse.json({ ok: true, ...result });
  });
}

export const GET = handle;
export const POST = handle;
