export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { json } from '@/lib/api/json';

// Emoji and tag policies
const ALLOWED_EMOJIS = ['🌱', '💪', '🚀', '🧘', '📚', '🎨', '🧠', '❤️'];
const ALLOWED_TAGS = [
  'fitness',
  'writing',
  'startup',
  'learning',
  'coding',
  'reading',
  'meditation',
  'water',
  'floss',
  'custom',
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { bio, emoji, goal_tags, visible, handle } = body;

  if (!handle || typeof handle !== 'string' || !/^[a-z0-9_-]{3,32}$/.test(handle)) {
    return json({ error: 'Invalid handle' }, { status: 400 });
  }

  if (emoji && !ALLOWED_EMOJIS.includes(emoji)) {
    return json({ error: 'Invalid emoji' }, { status: 400 });
  }

  if (!Array.isArray(goal_tags) || goal_tags.some((tag) => !ALLOWED_TAGS.includes(tag))) {
    return json({ error: 'Invalid goal tags' }, { status: 400 });
  }
  
  const serverSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookies() } // @ts-ignore
  );
  
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  // Ensure no other user is using this handle
  const { data: handleConflict } = await supabase
    .from('public_profiles')
    .select('user_id')
    .eq('handle', handle)
    .neq('user_id', user.id)
    .maybeSingle();

  if (handleConflict) {
    return json({ error: 'Handle already taken' }, { status: 409 });
  }

  // Upsert the profile
  const { error: upsertError } = await supabase.from('public_profiles').upsert({
    user_id: user.id,
    handle,
    bio: bio || '',
    emoji,
    goal_tags,
    visible: visible === true,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    return json({ error: upsertError.message }, { status: 500 });
  }

  return json({ success: true });
}
