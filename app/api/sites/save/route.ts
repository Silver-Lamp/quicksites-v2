export const runtime = 'nodejs';

import { json } from '@/lib/api/json';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const body = await req.json();
  const { id, data } = body;

  if (!id || !data) {
    return json({ error: 'Missing site ID or data' }, { status: 400 });
  }

  const userSupabase = await getServerSupabase();

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Confirm ownership of site before writing. (This route previously referenced a
  // non-existent `created_by`/`content` column and always errored; it now uses the
  // real `owner_id`/`data` columns added by the sites owner-column migration.)
  const { data: site, error: fetchError } = await supabaseAdmin
    .from('sites')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !site) {
    return json({ error: 'Site not found' }, { status: 404 });
  }

  if ((site as any).owner_id !== user.id) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('sites')
    .update({
      data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Save error:', updateError);
    return json({ error: updateError.message }, { status: 500 });
  }

  return json({ success: true });
}
