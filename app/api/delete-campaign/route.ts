export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const { slug } = await req.json();

  if (!slug || !token) {
    return Response.json({ error: 'Missing slug or token' }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: campaign, error: fetchError } = await supabase
    .from('support_campaigns')
    .select('id, created_by')
    .eq('slug', slug)
    .single();

  if (fetchError || !campaign) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const isOwner = campaign.created_by === user.id;
  const isAdmin = user.user_metadata?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', campaign.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
