import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';
import { create } from 'jsondiffpatch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end();

  const { template_name, newData, editor_id, commit_message } = req.body;

  const { data: existing } = await supabase
    .from('templates')
    .select('data')
    .eq('template_name', template_name)
    .single();

  const diffpatch = create();
  const diff = diffpatch.diff(existing?.data, newData);

  const { error: updateErr } = await supabase
    .from('templates')
    .update({ data: newData })
    .eq('template_name', template_name);

  await supabase.from('template_versions').insert({
    template_name,
    full_data: newData,
    diff,
    editor_id,
    commit_message: commit_message || 'Update from editor',
  });

  if (updateErr) return json({ error: updateErr.message });

  json({ success: true });
}
