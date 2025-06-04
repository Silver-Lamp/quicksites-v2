// POST /api/templates/revert
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SAFETY_MINUTES = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { template_name, data, editor_id, force = false } = req.body;

  // Fetch current template data + timestamp
  const { data: current, error: currentErr } = await supabase
    .from('templates')
    .select('data, updated_at')
    .eq('template_name', template_name)
    .single();

  if (currentErr) return res.status(500).json({ error: currentErr.message });

  // Enforce safety buffer
  if (!force) {
    const updatedAt = new Date(current.updated_at);
    const now = new Date();
    const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
  
    if (diffInMinutes < SAFETY_MINUTES) {
      return res.status(403).json({
        error: `Template was updated ${diffInMinutes.toFixed(1)} minutes ago. Reverts are blocked for ${SAFETY_MINUTES} minutes unless forced.`,
        recent: true
      });
    }
  }

  // Save version backup
  await supabase.from('template_versions').insert([{
    template_name,
    full_data: current.data,
    diff: null,
    commit_message: force
      ? '⚠️ Forced Revert triggered from admin history UI'
      : 'Revert triggered from admin history UI',
    editor_id,
    forced_revert: !!force
  }]);

  // Overwrite with selected version
  const { error } = await supabase
    .from('templates')
    .update({ data })
    .eq('template_name', template_name);

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ success: true });
}
