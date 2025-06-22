export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch feedback (sent or received) for authenticated user
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: auth } = await supabase.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'sent'; // default to sent
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const column = type === 'sent' ? 'user_id' : 'block_owner_id';

  const { data, error } = await supabase
    .from('block_feedback')
    .select('*')
    .eq(column, user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return json({ error: error.message }, { status: 500 });

  return json(data);
}

// POST: Add new feedback
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: auth } = await supabase.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { block_id, action = 'echo', message = '' } = body;

  if (!block_id) return json({ error: 'Missing block_id' }, { status: 400 });

  const { error } = await supabase.from('block_feedback').insert({
    block_id,
    user_id: user.id,
    action,
    message,
  });

  if (error) return json({ error: error.message }, { status: 500 });

  return json({ success: true });
}
