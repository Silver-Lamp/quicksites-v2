export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const { block_id, message } = await req.json();

  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user || !block_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase.from('block_feedback').insert({
    block_id,
    user_id: user.id,
    action: 'cheer',
    message: message || null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
