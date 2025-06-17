import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { supabase } from '@/lib/supabaseClient.js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return json({ error: error.message });
    return json({ users: data.users || [] });
  } catch (err: any) {
    return json({ error: err.message || 'Server error' });
  }
}
