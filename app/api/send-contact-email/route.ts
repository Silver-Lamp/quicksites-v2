import { Resend } from 'resend';
import { lazyClient } from '@/lib/lazyClient';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { orgEmailBrand } from '@/lib/email';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

const isEmail = (x: unknown): x is string =>
  typeof x === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export async function POST(req: Request) {
  // Public site contact form → throttle per IP. NOTE: `to` is still client-
  // supplied; deriving the recipient from `site_slug` server-side (so it can't be
  // used as an open relay) is a tracked follow-up. Interim: rate limit + cap the
  // recipient count + require well-formed addresses.
  const limited = await rateLimitOr429(req, 'contact_email', 10, 3600);
  if (limited) return limited;

  const {
    to,
    subject,
    message,
    user_email,
    site_slug,
    form_submission_id,
  } = await req.json();

  if (!to?.length || !subject || !message) {
    console.log('Missing required fields', { to, subject, message });
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const uniqueRecipients = Array.from(new Set(to)).filter(isEmail);
  if (uniqueRecipients.length === 0 || uniqueRecipients.length > 5) {
    return NextResponse.json({ error: 'Invalid recipient list' }, { status: 400 });
  }

  let status = 'pending';
  let response_id: string | null = null;
  let error: string | null = null;

  try {
    const brand = await orgEmailBrand();
    const response = await resend.emails.send({
      from: brand.from,
      to: uniqueRecipients as string[],
      subject,
      text: message,
    });

    status = 'sent';
    response_id = response?.data?.id || null;

    // Send confirmation to the user if applicable
    if (user_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      await resend.emails.send({
        from: brand.from,
        to: [user_email],
        subject: 'Thanks for contacting us!',
        text: `Hi there,\n\nThanks for reaching out. We’ve received your message and will get back to you shortly.\n\n${brand.footer}`,
      });
    }
  } catch (err: any) {
    console.error('[Email error]', err);
    status = 'error';
    error = err.message || 'Unexpected error';
  }

  // Log email to Supabase
  await supabase.from('email_logs').insert([{
    to: uniqueRecipients,
    user_email,
    subject,
    message,
    status,
    response_id,
    error,
    site_slug,
    form_submission_id,
  }]);

  if (status === 'error') {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: response_id });
}
