// pages/api/admin/logs-export-csv.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data: user, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.user) return res.status(401).json({ error: 'Unauthorized' });

  const role = user.user.user_metadata?.role;
  if (!['admin', 'owner'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const table = req.query.table as string || 'log_events';
  const { data, error } = await supabase.from(table).select('*');
  if (error) return res.status(500).json({ error: error.message });

  const headers = Object.keys(data[0] || {}).join(',');
  const rows = data.map((row) => Object.values(row).map((v) => JSON.stringify(v)).join(',')).join('\n');

  const csv = `${headers}\n${rows}`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=`${table}-export.csv`');
  res.status(200).send(csv);
}
