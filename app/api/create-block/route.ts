// app/api/create-block/route.ts
// Use createBlock() when you need to create a block
// Use getUserFromRequest() when you need the user context
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { json } from '@/lib/api/json'; // Optional utility if available

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { title, message, lat, lon, emoji } = await req.json();
  const token = req.headers.get('authorization')?.replace('Bearer ', '');

  if (!title || lat === undefined || lon === undefined) {
    return json({ error: 'Missing fields: title, lat, or lon' }, { status: 400 });
  }

  if (!token) {
    return json({ error: 'Missing token' }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error: insertError } = await supabase
    .from('blocks')
    .insert({
      owner_id: user.id,
      title,
      message,
      lat,
      lon,
      emoji,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[❌ Block Creation Error]', insertError.message);
    return json({ error: insertError.message }, { status: 500 });
  }

  return json({ success: true, data });
}
