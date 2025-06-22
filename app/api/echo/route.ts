export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Limit to 3 echo actions per block per user per hour
const MAX_ECHOES_PER_HOUR = 3;

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { block_id, message } = await req.json();

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user || !block_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for recent echo actions
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error: rateError } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', block_id)
    .eq('user_id', user.id)
    .eq('action', 'echo')
    .gte('created_at', oneHourAgo);

  if (rateError) {
    return Response.json({ error: 'Rate check failed' }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_ECHOES_PER_HOUR) {
    return Response.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const { error } = await supabase.from('block_feedback').insert({
    block_id,
    user_id: user.id,
    action: 'echo',
    message: message || null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
