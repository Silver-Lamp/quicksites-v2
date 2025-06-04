import { sendDigestEmails } from '@/lib/sendDigestEmails';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  await sendDigestEmails();
  res.status(200).json({ success: true });
}
