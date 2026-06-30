// app/api/cron/agency-site-sync/route.ts
//
// Nightly reconcile of agency per-site subscription quantities (Path B). For
// every user on an active agency plan, set their Stripe per-site line quantity
// to their current published-site count. This is the source of truth for
// per-site billing; opportunistic syncs on publish/unpublish are best-effort.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { syncAgencySiteQuantity } from '@/lib/billing/agency';
import { ACTIVE_PLAN_STATUSES } from '@/lib/billing/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return runCron('agency-site-sync', async () => {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
    );

    const { data: rows, error } = await (admin as any)
      .from('user_plans')
      .select('user_id, plan, status')
      .ilike('plan', 'agency%');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const users = (rows || []).filter((r: any) => ACTIVE_PLAN_STATUSES.has(r.status));

    let synced = 0;
    let skipped = 0;
    const errors: Array<{ user_id: string; error: string }> = [];
    for (const r of users) {
      try {
        const res = await syncAgencySiteQuantity(r.user_id, admin as any);
        if (res.synced) synced++;
        else skipped++;
      } catch (e: any) {
        errors.push({ user_id: r.user_id, error: String(e?.message || e).slice(0, 200) });
      }
    }

    return NextResponse.json({
      ok: true,
      considered: users.length,
      synced,
      skipped,
      errors: errors.length ? errors : undefined,
    });
  });
}

// Vercel native cron invokes via GET; allow POST for manual/secret-header runs.
export const GET = handle;
export const POST = handle;
