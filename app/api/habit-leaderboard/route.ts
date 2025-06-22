// app/api/habit-leaderboard/route.ts
import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const range = searchParams.get('range') || 'weekly';

  if (!slug) return json({ error: 'Missing slug' });

  // 🔁 Check cache (valid for 5 minutes)
  const { data: cached } = await supabase
    .from('leaderboard_cache')
    .select('payload, cached_at')
    .eq('slug', slug)
    .eq('range', range)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.cached_at).getTime() < 5 * 60 * 1000) {
    return json({ from_cache: true, ...cached.payload });
  }

  // 🧠 Fresh compute
  const { data, error } = await supabase.rpc('leaderboard_for_slug', { slug });

  if (error || !data) return json({ error: error?.message || 'RPC failed' });

  const payload = { from_cache: false, data };

  // ✍️ Upsert into cache
  await supabase.from('leaderboard_cache').upsert({
    slug,
    range,
    payload,
    cached_at: new Date().toISOString(),
  });

  return json(payload);
}
