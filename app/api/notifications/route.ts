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
  const handle = searchParams.get('handle');

  if (!handle) {
    return json({ error: 'Missing handle' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('support_requests')
    .select('*')
    .eq('receiver_handle', handle)
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, { status: 500 });

  return json(data);
}
