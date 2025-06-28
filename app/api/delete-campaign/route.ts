// app/api/delete-campaign/route.ts
// Use deleteCampaign() when you need to delete a campaign
// Use getUserFromRequest() when you need the user context
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { json } from '@/lib/api/json'; // Optional: use your internal JSON wrapper

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const { slug } = await req.json();

  if (!slug || !token) {
    return json({ error: 'Missing slug or token' }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: roleError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (roleError || !profile?.role) {
    return json({ error: 'Unable to fetch user role' }, { status: 403 });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('support_campaigns')
    .select('id, created_by')
    .eq('slug', slug)
    .maybeSingle();

  if (campaignError || !campaign) {
    return json({ error: 'Campaign not found' }, { status: 404 });
  }

  const isOwner = campaign.created_by === user.id;
  const isAdmin = profile.role === 'admin';

  if (!isOwner && !isAdmin) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', campaign.id);

  if (updateError) {
    return json({ error: updateError.message }, { status: 500 });
  }

  return json({ success: true });
}
