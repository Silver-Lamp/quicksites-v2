// app/api/echo/route.ts
// Use echo() when you need to echo a message
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ECHOES_PER_HOUR = 3;

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')?.trim();

    if (!token) {
      return Response.json({ error: 'Missing auth token' }, {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { block_id, message } = await req.json();

    if (!block_id) {
      return Response.json({ error: 'Missing block_id' }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      return Response.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count, error: rateError } = await supabase
      .from('block_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('block_id', block_id)
      .eq('user_id', user.id)
      .eq('action', 'echo')
      .gte('created_at', oneHourAgo);

    if (rateError) {
      console.error('[⚠️ Rate check error]', rateError.message);
      return Response.json({ error: 'Rate check failed' }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if ((count ?? 0) >= MAX_ECHOES_PER_HOUR) {
      return Response.json({ error: 'Rate limit exceeded. Try again later.' }, {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error: insertError } = await supabase
      .from('block_feedback')
      .insert({
        block_id,
        user_id: user.id,
        action: 'echo',
        message: message || null,
      });

    if (insertError) {
      console.error('[❌ Insert error]', insertError.message);
      return Response.json({ error: insertError.message }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return Response.json({ success: true }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[❌ Unexpected echo error]', err);
    return Response.json({ error: err?.message ?? 'Unknown error' }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
