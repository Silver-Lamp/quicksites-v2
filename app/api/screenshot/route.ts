// app/api/screenshot/route.ts
export const runtime = 'nodejs'; // nodejs runtime to allow supabase server client

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { domain } = await req.json();

  if (!domain) {
    return new Response(JSON.stringify({ error: 'Missing domain' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
