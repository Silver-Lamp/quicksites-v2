// pages/api/slack/actions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = JSON.parse(req.body?.payload || '{}');
    const action = payload?.actions?.[0];
    const value = action?.value;

    if (!value || !value.includes(':')) {
      return res.status(400).json({ error: 'Missing action value' });
    }

    const [command, id] = value.split(':');
    const status = command === 'approve' ? 'approved' : command === 'reject' ? 'rejected' : null;

    if (!status) return res.status(400).json({ error: 'Invalid action' });

    await supabase.from('access_requests').update({ status }).eq('id', id);

    return res.status(200).json({ text: `✅ Request ${id} marked as ${status}.` });
  } catch (err) {
    console.error('Slack action error:', err);
    return res.status(500).json({ error: 'Failed to process action' });
  }
}
