import { writeFile } from 'fs/promises';
import { json } from '@/lib/api/json';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  if (!req.body) {
    throw new Error('Request body is null');
  }

  const reader = req.body.getReader();
  const buffers = [];
  let done, value;

  while (!done) {
    ({ done, value } = await reader.read());
    if (value) {
      buffers.push(value);
    }
  }

  const boundary = Buffer.concat(buffers);
  const match = /filename="(.+?)"/.exec(boundary.toString());
  const filename = match?.[1] || 'upload.png';
  const path = join(process.cwd(), 'public', filename);
  await writeFile(path, boundary as Uint8Array);
  return json({ success: true });
}
