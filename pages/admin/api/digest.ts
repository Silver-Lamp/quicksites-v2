import { sendDigestEmails } from '@/admin/lib/sendDigestEmails';
import { json } from '@/lib/api/json';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  await sendDigestEmails();
  json({ success: true });
}
