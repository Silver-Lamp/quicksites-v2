// app/api/update-campaign/route.ts
export const runtime = 'nodejs';

import { json } from '@/lib/api/json';
import { getSupabase } from '@/lib/supabase/universal';
import { createClient } from '@supabase/supabase-js';

// Service client for updates (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { slug, headline, goal_count, target_action, block_id } = await req.json();

  if (!slug || typeof slug !== 'string') {
    return json({ error: 'Missing or invalid slug' }, { status: 400 });
  }

  if (goal_count !== undefined && typeof goal_count !== 'number') {
    return json({ error: 'Invalid goal_count (must be a number)' }, { status: 400 });
  }

  const userSupabase = await getSupabase({ req: req as Request }); // ✅ Auth-bound client

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign, error: fetchError } = await supabase
    .from('support_campaigns')
    .select('created_by')
    .eq('slug', slug)
    .single();

  if (fetchError || !campaign) {
    return json({ error: 'Campaign not found' }, { status: 404 });
  }

  const isOwner = campaign.created_by === user.id;
  const isAdmin = user.role === 'admin'; // Adjust based on your user schema

  if (!isOwner && !isAdmin) {
    return json({ error: 'Forbidden: not owner or admin' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({
      headline,
      goal_count,
      target_action,
      block_id,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (updateError) {
    return json({ error: updateError.message }, { status: 500 });
  }

  return json({ success: true });
}
