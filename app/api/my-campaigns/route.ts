// app/api/my-campaigns/route.ts
// Use myCampaigns() when you need to get the user's campaigns
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const token = req.headers.get('authorization')?.replace('Bearer ', '');

  if (!user_id) {
    return Response.json({ error: 'Missing user_id' }, { status: 400 });
  }

  // 🧭 No token: return public campaigns
  if (!token) {
    const { data, error } = await supabase
      .from('support_campaigns')
      .select('slug, headline, created_at')
      .eq('created_by', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
  }

  // 🔐 Authenticated path
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const isAdmin = user.email?.endsWith('@quicksites.ai');

  if (user.id !== user_id && !isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ✅ Full access to campaigns
  const { data, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('created_by', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
}
