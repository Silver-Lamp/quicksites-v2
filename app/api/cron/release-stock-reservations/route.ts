import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Release stock held by abandoned checkouts: reservations that are still 'held'
// past their expires_at get their units returned to inventory. Runs frequently so
// held stock frees up shortly after a buyer walks away. (reserve-then-confirm)
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('release-stock-reservations', async () => {
    const supabase = await getServerSupabase({ serviceRole: true });
    const { data, error } = await (supabase as any).rpc('sweep_expired_reservations');
    if (error) throw error;
    return NextResponse.json({ ok: true, released: data ?? 0 });
  });
}

export const GET = handle;
export const POST = handle;
