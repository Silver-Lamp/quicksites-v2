import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { file, token } = req.query;

  if (
    !file ||
    !token ||
    typeof file !== 'string' ||
    typeof token !== 'string'
  ) {
    return json({ error: 'Missing file or token' });
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const { data, error } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('file_name', file)
    .eq('token_hash', hash)
    .lte('expires_at', new Date().toISOString())
    .limit(1)
    .single();

  if (error || !data) {
    return json({ error: 'Invalid or expired token' });
  }

  const filePath = path.resolve(`./reports/analytics/${file}`);
  if (!fs.existsSync(filePath)) {
    return json({ error: 'File not found' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(filePath).pipe(res);
}
