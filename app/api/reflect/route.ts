export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  const { block_id, message } = await req.json();

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user || !block_id) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  // 🛡️ Rate limit: prevent more than 1 reflection per 5 min per user/block
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', block_id)
    .eq('user_id', user.id)
    .eq('action', 'reflect')
    .gt('created_at', fiveMinAgo);

  if (count && count > 0) {
    return json({ error: 'Rate limit: Please wait before reflecting again.' }, { status: 429 });
  }

  const { error } = await supabase.from('block_feedback').insert({
    block_id,
    user_id: user.id,
    action: 'reflect',
    message: message || null,
    metadata: {
      ip,
      timestamp: new Date().toISOString(),
    },
  });

  if (error) return json({ error }, { status: 500 });

  return json({ success: true });
}
