export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url || '');
  const handle = searchParams.get('handle');
  const actionFilter = searchParams.get('action'); // optional: cheer, reflect, echo
  const since = searchParams.get('since'); // optional: ISO timestamp

  // ✅ 1. Require auth (via Authorization header)
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) return json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ 2. Validate input
  if (!handle) return json({ error: 'Missing handle' }, { status: 400 });

  // ✅ 3. Lookup block IDs owned by user
  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('id')
    .eq('owner_handle', handle);

  if (blocksError) return json({ error: blocksError.message }, { status: 500 });

  const blockIds = blocks?.map((b) => b.id) || [];
  if (!blockIds.length) return json([]);

  // ✅ 4. Build filters
  let query = supabase
    .from('block_feedback')
    .select('user_id, action, created_at')
    .in('block_id', blockIds);

  if (actionFilter) query = query.eq('action', actionFilter);
  if (since) query = query.gte('created_at', since);

  const { data: feedback, error: feedbackError } = await query;

  if (feedbackError) return json({ error: feedbackError.message }, { status: 500 });

  // ✅ 5. Aggregate support counts per user
  const supportMap: Record<
    string,
    { cheer: number; reflect: number; echo: number; latest: string }
  > = {};

  for (const fb of feedback) {
    const uid = fb.user_id;
    if (!supportMap[uid]) {
      supportMap[uid] = { cheer: 0, reflect: 0, echo: 0, latest: fb.created_at };
    }
    supportMap[uid][fb.action as keyof typeof supportMap[typeof uid]]++;
    if (new Date(fb.created_at) > new Date(supportMap[uid].latest)) {
      supportMap[uid].latest = fb.created_at;
    }
  }

  const userIds = Object.keys(supportMap);

  // ✅ 6. Enrich with user profile
  const { data: profiles, error: profileError } = await supabase
    .from('users')
    .select('id, user_metadata')
    .in('id', userIds);

  const profileMap = (profiles || []).reduce((acc, u) => {
    acc[u.id] = u.user_metadata || {};
    return acc;
  }, {} as Record<string, any>);

  // ✅ 7. Final output
  const result = userIds.map((uid) => ({
    user_id: uid,
    username: profileMap[uid]?.username || null,
    avatar_url: profileMap[uid]?.avatar_url || null,
    ...supportMap[uid],
  }));

  return json(result);
}
