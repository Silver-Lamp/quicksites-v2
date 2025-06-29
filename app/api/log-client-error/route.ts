// app/api/log-client-error/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request/getRequestContext';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    message = 'No message',
    context = {},
    route = req.headers.get('referer') ?? '',
  } = body;

  const {
    supabase,
    userId,
    role = 'guest',
    ip,
    userAgent,
    sessionId,
    abVariant,
    headers,
  } = await getRequestContext(true); // withSupabase = true

  const traceId = crypto.randomUUID(); // Optional correlation ID

  const payload = {
    message,
    context,
    route,
    user_id: userId ?? null,
    role,
    ip,
    user_agent: userAgent,
    session_id: sessionId,
    ab_variant: abVariant,
    trace_id: traceId,
    referrer: headers.get('referer') ?? '',
    path: req.nextUrl.pathname,
    created_at: new Date().toISOString(),
  };

  // Dev visibility
  if (process.env.NODE_ENV === 'development') {
    console.table(payload);
  }

  const { error } = await supabase!.client.from('client_errors').insert(payload);

  if (error) {
    console.warn('[log-client-error] Supabase insert failed', error);
    return NextResponse.json({ status: 'fail', error: error.message, traceId }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok', traceId });
}
