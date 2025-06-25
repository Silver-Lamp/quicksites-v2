export const runtime = 'nodejs';

import { json } from '@/lib/api/json';
import { getSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const body = await req.json();
  const { id, data } = body;

  if (!id || !data) {
    return json({ error: 'Missing site ID or data' }, { status: 400 });
  }

  const userSupabase = await getSupabase();

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Confirm ownership of site before writing
  const { data: site, error: fetchError } = await supabaseAdmin
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

  const { error: updateError } = await supabaseAdmin
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
