export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const block_id = searchParams.get('block_id');
  const action = searchParams.get('action');

  if (!block_id || !action) {
    return json({ error: 'Missing block_id or action' }, { status: 400 });
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', block_id)
    .eq('action', action)
    .gt('created_at', oneWeekAgo.toISOString());

  if (error) return json({ error: error.message }, { status: 500 });

  return json({ count });
}
