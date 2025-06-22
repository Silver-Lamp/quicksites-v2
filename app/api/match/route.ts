export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tags = searchParams.get('tags');

  if (!tags || typeof tags !== 'string') {
    return Response.json({ error: 'Missing or invalid tags' }, { status: 400 });
  }

  const tagArray = tags.split(',').map((t) => t.trim());

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .contains('goal_tags', tagArray)
    .eq('visible', true)
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
