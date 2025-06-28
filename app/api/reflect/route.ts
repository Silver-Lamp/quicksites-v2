// app/api/reflect/route.ts
// Use reflect() when you need to reflect on a block
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request): Promise<Response> {
  const supabase = getSupabaseClient();

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const { block_id, message } = await req.json();

  if (!token || !block_id) {
    return json({ error: 'Missing token or block_id' }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  // ⏱️ Enforce rate limit: 1 reflection per user/block every 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count: recentCount, error: rateError } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', block_id)
    .eq('user_id', user.id)
    .eq('action', 'reflect')
    .gt('created_at', fiveMinutesAgo);

  if (rateError) {
    return json({ error: 'Rate check failed' }, { status: 500 });
  }

  if ((recentCount ?? 0) > 0) {
    return json({ error: 'Rate limit: Please wait before reflecting again.' }, { status: 429 });
  }

  const { error: insertError } = await supabase.from('block_feedback').insert({
    block_id,
    user_id: user.id,
    action: 'reflect',
    message: message || null,
    metadata: {
      ip,
      timestamp: new Date().toISOString(),
    },
  });

  if (insertError) {
    return json({ error: insertError.message }, { status: 500 });
  }

  return json({ success: true });
}
