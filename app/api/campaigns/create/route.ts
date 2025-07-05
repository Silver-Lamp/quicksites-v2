// app/api/campaigns/create/route.ts
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = getSupabaseClient();
  const body = await req.json();

  const {
    name,
    city,
    state,
    industry,
    status = 'draft',
    starts_at,
    ends_at,
    alt_domains,
    lead_ids,
    city_lat,
    city_lon,
    silent_mode,
  } = body;

  if (!name || !city || !state || !industry || !starts_at || !ends_at) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Step 1: Create campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      name,
      city,
      state,
      industry,
      status,
      starts_at,
      ends_at,
      alt_domains,
      city_lat,
      city_lon,
      silent_mode,
    })
    .select()
    .single();

  if (campaignError) {
    console.error('[❌ create campaign]', campaignError);
    return Response.json({ error: campaignError.message }, { status: 500 });
  }

  // Step 2: Link leads (via join table)
  if (Array.isArray(lead_ids) && lead_ids.length > 0) {
    const leadLinks = lead_ids.map((lead_id) => ({ campaign_id: campaign.id, lead_id }));
    const { error: linkError } = await supabase.from('campaign_leads').insert(leadLinks);
    if (linkError) {
      console.error('[❌ link leads]', linkError);
      return Response.json({ error: linkError.message }, { status: 500 });
    }

    // Step 3: Update leads with campaign_id + expiration
    const { error: updateLeadsError } = await supabase
      .from('leads')
      .update({
        current_campaign_id: campaign.id,
        current_campaign_expires_at: ends_at,
      })
      .in('id', lead_ids);

    if (updateLeadsError) {
      console.error('[❌ update leads]', updateLeadsError);
      return Response.json({ error: updateLeadsError.message }, { status: 500 });
    }
  }

  return Response.json({ success: true, campaign_id: campaign.id });
}
