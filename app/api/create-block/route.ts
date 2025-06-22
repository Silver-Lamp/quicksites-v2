export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { title, message, lat, lon, emoji } = await req.json();

  if (!lat || !lon || !title) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const auth = req.headers.get('authorization')?.replace('Bearer ', '');

  const {
    data: { user },
  } = await supabase.auth.getUser(auth);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.from('blocks').insert({
    owner_id: user.id,
    title,
    message,
    lat,
    lon,
    emoji,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data });
}
