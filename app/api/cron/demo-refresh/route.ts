// app/api/cron/demo-refresh/route.ts
//
// Scheduled top-up of AI demo sites. OFF by default — only runs when
// DEMO_AUTOGEN_ENABLED=true (so it never spends on AI until you opt in).
// Per-run count: DEMO_AUTOGEN_PER_RUN (default 1, max 5).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { generateDemoSite } from '@/lib/builder/generateDemoSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function firstAdminOwner(): Promise<string | null> {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await db.from('admin_users').select('user_id').limit(1);
    return data?.[0]?.user_id ?? null;
  } catch {
    return null;
  }
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('demo-refresh', async () => {
    if (process.env.DEMO_AUTOGEN_ENABLED !== 'true') {
      return NextResponse.json({ ok: true, skipped: 'DEMO_AUTOGEN_ENABLED!=true' });
    }
    const count = Math.max(1, Math.min(5, Number(process.env.DEMO_AUTOGEN_PER_RUN || '1')));
    const ownerId = await firstAdminOwner();

    const results = [];
    for (let i = 0; i < count; i++) {
      const seed = `cron-${Date.now()}-${i}`;
      // eslint-disable-next-line no-await-in-loop
      results.push(await generateDemoSite({ ownerId, seed }));
    }
    return NextResponse.json({
      ok: true,
      created: results.filter((r: any) => r.ok && !r.dryRun).length,
      results,
    });
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
