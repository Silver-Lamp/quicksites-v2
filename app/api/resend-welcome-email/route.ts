export const runtime = 'nodejs';

import { Resend } from 'resend';
import { lazyClient } from '@/lib/lazyClient';
import { json } from '@/lib/api/json';
import { orgEmailBrand } from '@/lib/email';

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

export async function POST(req: Request) {
  const { email, name, slug, templateName } = await req.json();

  const dashboardLink = `https://quicksites.ai/edit/${slug}`;
  const publicLink = `https://${slug}.quicksites.ai`;

  try {
    // White-label: reseller orgs send under their own brand (docs/WHITE_LABEL_PLAN Slice 1).
    const brand = await orgEmailBrand();
    await resend.emails.send({
      from: brand.from,
      to: [email],
      subject: `🚀 Your ${brand.name} site is ready!`,
      html: `
        <h1>Welcome, ${name || 'there'} 👋</h1>
        <p>Your new site has been created using <strong>${templateName}</strong>.</p>
        <p>You can start customizing it right now:</p>
        <p><a href="${dashboardLink}" style="font-size: 16px; font-weight: bold;">🛠 Edit My Site</a></p>
        <p>Or check out your public site:</p>
        <p><a href="${publicLink}">${publicLink}</a></p>
        <hr />
        <p>Need help? Just reply to this email or visit our support page.</p>
        <p>${brand.footer}</p>
      `,
    });

    return json({ sent: true });
  } catch (e: any) {
    return json({ error: e.message });
  }
}
