import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { domain } = JSON.parse(req.body);

  const webhook = process.env.VERCEL_DEPLOY_WEBHOOK;
  if (!webhook || !domain) {
    return json({ error: 'Missing info' });
  }

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });

  return json({ triggered: true });
}
