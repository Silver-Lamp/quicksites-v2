import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    return json({ error: 'Missing required fields' });
  }

  console.log('📧 MOCK EMAIL');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('Message:', message);
  console.log('---');

  return json({ message: 'Email sent (mock)' });
}
