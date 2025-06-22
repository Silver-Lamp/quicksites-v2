export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  const token = searchParams.get('token');

  if (!file || !token) {
    return Response.json({ error: 'Missing file or token' }, { status: 400 });
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const { data, error } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('file_name', file)
    .eq('token_hash', hash)
    .lte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  const filePath = path.resolve(`./reports/analytics/${file}`);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: 'File not found' }, { status: 404 });
  }

  const fileStream = fs.createReadStream(filePath);
  const readable = new Readable().wrap(fileStream);

  return new Response(readable as any, {
    headers: {
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Type': 'application/pdf',
    },
  });
}
