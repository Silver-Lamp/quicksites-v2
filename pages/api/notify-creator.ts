import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query;
  if (!slug) return json({ error: 'Missing slug' });

  const { data: campaign } = await supabase
    .from('support_campaigns')
    .select('headline, created_by')
    .eq('slug', slug)
    .single();

  if (!campaign) return json({ error: 'Campaign not found' });

  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', campaign.created_by)
    .single();

  if (!user || !user.email) return json({ error: 'Creator email not found' });

  await resend.emails.send({
    from: 'awards@quicksites.ai',
    to: user.email,
    subject: '🏆 Your Campaign Just Earned a Badge!',
    html: `
      <h1>🎉 Congratulations!</h1>
      <p>Your campaign "<strong>${campaign.headline}</strong>" has been recognized as a weekly top campaign.</p>
      <p>You can view and share your badge here:</p>
      <a href="https://quicksites.ai/support/${slug}?badge=done">View My Badge</a>
    `,
  });

  json({ status: 'ok' });
}
