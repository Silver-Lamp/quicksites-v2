export const runtime = 'nodejs';

import { Resend } from 'resend';
import { json } from '@/lib/api/json';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email, name, slug, templateName } = await req.json();

  const dashboardLink = `https://quicksites.ai/edit/${slug}`;
  const publicLink = `https://${slug}.quicksites.ai`;

  try {
    await resend.emails.send({
      from: 'QuickSites <welcome@quicksites.ai>',
      to: [email],
      subject: `🚀 Your QuickSite is Ready!`,
      html: `
        <h1>Welcome, ${name || 'there'} 👋</h1>
        <p>Your new QuickSite has been created using <strong>${templateName}</strong>.</p>
        <p>You can start customizing it right now:</p>
        <p><a href="${dashboardLink}" style="font-size: 16px; font-weight: bold;">🛠 Edit My Site</a></p>
        <p>Or check out your public site:</p>
        <p><a href="${publicLink}">${publicLink}</a></p>
        <hr />
        <p>Need help? Just reply to this email or visit our support page.</p>
        <p>— The QuickSites Team</p>
      `,
    });

    return json({ sent: true });
  } catch (e: any) {
    return json({ error: e.message });
  }
}
