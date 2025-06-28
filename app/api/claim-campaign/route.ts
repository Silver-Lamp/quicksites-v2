// app/api/claim-campaign/route.ts
// Use claimCampaign() when you need to claim a campaign
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  const { preclaim_token } = await req.json();

  if (!token || !preclaim_token) {
    return Response.json({ error: 'Missing token or preclaim_token' }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign, error: fetchError } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('preclaim_token', preclaim_token)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!campaign) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({
      created_by: user.id,
      preclaim_token: null,
    })
    .eq('id', campaign.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
