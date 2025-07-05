// app/api/campaigns/update/route.ts
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
    id,
    name,
    city,
    state,
    city_lat,
    city_lon,
    starts_at,
    ends_at,
    lead_ids,
    industry,
    status,
  } = body;

  if (!id || !name || !city || !state || !industry || !starts_at || !ends_at) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Step 1: Update the campaign
  const { data: updated, error } = await supabase
    .from('campaigns')
    .update({
      name,
      city,
      state,
      city_lat,
      city_lon,
      starts_at,
      ends_at,
      industry,
      status,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[❌ update campaign]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Step 2: Update campaign_leads join table
  if (Array.isArray(lead_ids)) {
    // Delete previous links
    await supabase.from('campaign_leads').delete().eq('campaign_id', id);

    // Insert new links
    const linkData = lead_ids.map((lead_id) => ({ campaign_id: id, lead_id }));
    const { error: linkError } = await supabase.from('campaign_leads').insert(linkData);
    if (linkError) {
      console.error('[❌ update campaign_leads]', linkError);
      return Response.json({ error: linkError.message }, { status: 500 });
    }

    // Step 3: Update leads' campaign metadata
    const { error: updateLeadsError } = await supabase
      .from('leads')
      .update({
        current_campaign_id: id,
        current_campaign_expires_at: ends_at,
      })
      .in('id', lead_ids);

    if (updateLeadsError) {
      console.error('[❌ update leads]', updateLeadsError);
      return Response.json({ error: updateLeadsError.message }, { status: 500 });
    }
  }

  return Response.json({ updated });
}
