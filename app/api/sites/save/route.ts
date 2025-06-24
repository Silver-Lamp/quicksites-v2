// app/api/sites/save/route.ts
export const runtime = 'nodejs';

import { json } from '@/lib/api/json';
import { getSupabase } from '@/lib/supabase/universal';
import { createClient } from '@supabase/supabase-js';

// Used for privileged database writes (skip RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { id, data } = body;

  if (!id || !data) {
    return json({ error: 'Missing site ID or data' }, { status: 400 });
  }

  const userSupabase = await getSupabase(); // ✅ App Router-safe auth client

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Confirm ownership
  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('id, created_by')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !site) {
    return json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.created_by !== user.id) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('sites')
    .update({
      content: data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Save error:', updateError);
    return json({ error: updateError.message }, { status: 500 });
  }

  return json({ success: true });
}
