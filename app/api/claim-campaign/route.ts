export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const { preclaim_token } = await req.json();

  if (!token || !preclaim_token) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('preclaim_token', preclaim_token)
    .maybeSingle();

  if (error || !campaign) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({ created_by: user.id, preclaim_token: null })
    .eq('id', campaign.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
