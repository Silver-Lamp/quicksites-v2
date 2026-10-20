// app/api/admin/campaign-data/route.ts
//
// Admin-gated + service role (2026-10-20). It used to run on the edge with the browser client
// and NO gate: a public endpoint paging `guest_upgrade_events` and `user_action_logs`. Both
// tables are now RLS-scoped, so the old shape would have answered empty — this makes it an
// admin route that answers.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/requireUser';
import { json } from '@/lib/api/json';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '200');
  const from = searchParams.get('rangeFrom');
  const to = searchParams.get('rangeTo');

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const fromISO = fromDate?.toISOString();
  const toISO = toDate?.toISOString();

  const offset = page * limit;

  const eventQuery = supabase
    .from('guest_upgrade_events')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (fromISO && toISO) {
    eventQuery.gte('created_at', fromISO).lte('created_at', toISO);
  }

  const logQuery = supabase
    .from('user_action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (fromISO && toISO) {
    logQuery.gte('created_at', fromISO).lte('created_at', toISO);
  }

  const [eventsRes, logsRes] = await Promise.all([eventQuery, logQuery]);

  return json({
    events: eventsRes.data || [],
    logs: logsRes.data || [],
    nextPage: eventsRes.data?.length === limit ? page + 1 : null,
  });
}
