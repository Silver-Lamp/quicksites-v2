export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { serviceClient as supabase } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return Response.json({ error: 'Missing slug' }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !campaign) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { count } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', campaign.block_id)
    .eq('action', campaign.target_action);

  return Response.json({ ...campaign, count: count || 0 });
}
