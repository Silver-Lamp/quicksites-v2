import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendDigestEmails() {
  const since = new Date();
  since.setDate(since.getDate() - 1);

  const { data: views } = await supabase
    .from('template_views')
    .select('*')
    .gte('viewed_at', since.toISOString());

  const viewsByDomain: Record<string, any[]> = {};
  views?.forEach((v) => {
    if (!viewsByDomain[v.domain]) viewsByDomain[v.domain] = [];
    viewsByDomain[v.domain].push(v);
  });

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('email, domain, unsubscribe_token');

  for (const sub of subs || []) {
    const domainViews = viewsByDomain[sub.domain] || [];
    const total = domainViews.length;
    const body = `Hi! You had ${total} views on ${sub.domain} in the past 24h. Unsubscribe: https://yourdomain.com/unsubscribe/${sub.unsubscribe_token}`;

    await resend.emails.send({
      from: 'updates@yourdomain.com',
      to: sub.email,
      subject: `Daily Digest for ${sub.domain}`,
      text: body,
    });
  }

  console.log('✅ Digest emails sent');
}
