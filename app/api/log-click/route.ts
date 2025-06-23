export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { block_id, action, handle } = await req.json();

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';

  const userAgent = req.headers.get('user-agent') || '';
  const referrer = req.headers.get('referer') || '';

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

  const { count: recent } = await supabase
    .from('click_events')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('block_id', block_id)
    .eq('action', action)
    .gt('created_at', since);

  const isDuplicate = (recent || 0) > 0;

  const { error, data } = await supabase
    .from('click_events')
    .insert({
      block_id,
      action,
      handle,
      ip,
      is_duplicate: isDuplicate,
      metadata: {
        ua: userAgent,
        referrer,
      },
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, { status: 500 });

  return json({ success: true, duplicate: isDuplicate, event_id: data?.id });
}
