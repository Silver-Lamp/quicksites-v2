// app/api/screenshot/route.ts
export const runtime = 'nodejs'; // nodejs runtime to allow supabase server client

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';

export async function POST(req: NextRequest) {
  // Was unauthenticated — anyone could enqueue screenshot jobs for any domain.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { domain } = await req.json();

  if (!domain) {
    return new Response(JSON.stringify({ error: 'Missing domain' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
  );

  await supabase.from('screenshot_queue').insert({
    domain,
    status: 'pending',
    requested_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ message: 'Queued for screenshot' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
