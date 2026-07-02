import { serviceClient as supabase } from '@/lib/supabase/service';
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  const token = searchParams.get('token');

  if (!file || !token) {
    return Response.json({ error: 'Missing file or token' }, { status: 400 });
  }

  // Reject anything that isn't a plain report filename — no path separators, no
  // '..'. Without this, `file=../../../.env.local` traverses out of the reports
  // dir and leaks arbitrary server files.
  if (!/^[A-Za-z0-9._-]+\.pdf$/.test(file)) {
    return Response.json({ error: 'Invalid file' }, { status: 400 });
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const { data, error } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('file_name', file)
    .eq('token_hash', hash)
    // Token must NOT be expired. (This was `.lte`, which accepted only ALREADY-
    // expired tokens — inverted; it let a planted past-dated token through.)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  // Belt-and-suspenders: resolve within the reports dir and confirm containment.
  const baseDir = path.resolve('./reports/analytics');
  const filePath = path.resolve(baseDir, path.basename(file));
  if (filePath !== path.join(baseDir, path.basename(file)) || !filePath.startsWith(baseDir + path.sep)) {
    return Response.json({ error: 'Invalid file' }, { status: 400 });
  }
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
