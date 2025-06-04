import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: data.users || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
