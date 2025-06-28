// app/api/clone-block/route.ts
// Use cloneBlock() when you need to clone a block
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { blockId } = await req.json();

    if (!blockId) {
      return Response.json({ error: 'Missing blockId' }, { status: 400 });
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: block, error: blockError } = await supabase
      .from('blocks')
      .select('*')
      .eq('id', blockId)
      .maybeSingle();

    if (blockError || !block) {
      return Response.json({ error: 'Block not found' }, { status: 404 });
    }

    const { error: insertError } = await supabase.from('blocks').insert({
      owner_id: user.id,
      title: block.title,
      message: block.message,
      lat: block.lat,
      lon: block.lon,
      emoji: block.emoji,
      image_url: block.image_url,
    });

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('[cloneBlock] Unexpected error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
