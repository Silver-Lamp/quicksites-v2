// app/api/campaigns/[id]/leads/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getClient();
  const campaignId = params.id;

  const { data, error } = await supabase
    .from('campaign_leads')
    .select('lead_id')
    .eq('campaign_id', campaignId);

  if (error) {
    console.error('[❌ Fetch campaign_leads]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const lead_ids = data.map((row) => row.lead_id);
  return Response.json({ lead_ids });
}
