import { writeFile } from 'fs/promises';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
import { join } from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const boundary = Buffer.concat(buffers);
  const match = /filename="(.+?)"/.exec(boundary.toString());
  const filename = match?.[1] || 'upload.png';
  const path = join(process.cwd(), 'public', filename);

  await writeFile(path, boundary);

  return json({ success: true });
}
