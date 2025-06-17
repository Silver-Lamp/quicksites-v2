// ✅ FILE: pages/api/ip.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.socket.remoteAddress;
  json({ ip });
}
