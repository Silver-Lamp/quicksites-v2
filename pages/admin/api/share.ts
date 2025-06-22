import { supabase } from '@/admin/lib/supabaseClient';
import { json } from '@/lib/api/json';
import type { NextApiRequest, NextApiResponse } from 'next';

type SnapshotPayload = {
  template_name: string;
  data: any; // consider typing this more specifically if possible
  editor_email?: string;
  branding_profile_id?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' });
  }

  const { template_name, data, editor_email, branding_profile_id } = req.body as SnapshotPayload;

  const { data: result, error } = await supabase
    .from('snapshots')
    .insert([
      {
        template_name,
        data,
        editor_email: editor_email || 'anonymous',
        shared_at: new Date().toISOString(),
        branding_profile_id,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[share.ts] Insert failed:', error);
    return json({ error: error.message });
  }

  return json(result);
}
