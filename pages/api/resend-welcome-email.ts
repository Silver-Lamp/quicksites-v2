import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const { email, name } = JSON.parse(_req.body);

  try {
    await resend.emails.send({
      from: 'QuickSites <welcome@quicksites.ai>',
      to: [email],
      subject: 'Welcome to QuickSites',
      html: `<strong>Hello${name ? ` ${name}` : ''}!</strong><br /><br />
        You've been added to our early access list. We’ll notify you soon.<br /><br />
        In the meantime, feel free to explore: https://quicksites.ai<br /><br />
        — The QuickSites Team`,
    });

    return json({ sent: true });
  } catch (e: any) {
    return json({ error: e.message });
  }
}
