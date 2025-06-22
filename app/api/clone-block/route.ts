export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { blockId } = await req.json();
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');

  const {
    data: { user },
  } = await supabase.auth.getUser(auth);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: block } = await supabase.from('blocks').select('*').eq('id', blockId).single();

  if (!block) {
    return Response.json({ error: 'Block not found' }, { status: 404 });
  }

  const { error } = await supabase.from('blocks').insert({
    owner_id: user.id,
    title: block.title,
    message: block.message,
    lat: block.lat,
    lon: block.lon,
    emoji: block.emoji,
    image_url: block.image_url,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
