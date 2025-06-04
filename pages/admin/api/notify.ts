import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log('📧 MOCK EMAIL');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('Message:', message);
  console.log('---');

  return res.status(200).json({ message: 'Email sent (mock)' });
}
