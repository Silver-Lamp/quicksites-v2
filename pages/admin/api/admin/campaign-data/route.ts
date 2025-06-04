// pages/api/admin/campaign-data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/admin/lib/supabaseClient';

export async function GET(req: NextRequest) {
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

  return NextResponse.json({
    events: eventsRes.data || [],
    logs: logsRes.data || [],
    nextPage: (eventsRes.data?.length === limit) ? page + 1 : null,
  });
}
