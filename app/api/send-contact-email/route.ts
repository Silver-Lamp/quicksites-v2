import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
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

  const uniqueRecipients = Array.from(new Set(to)).filter(Boolean);

  let status = 'pending';
  let response_id: string | null = null;
  let error: string | null = null;

  try {
    const response = await resend.emails.send({
      from: 'QuickSites Contact <sandon@contact.quicksites.ai>',
      to: uniqueRecipients as string[],
      subject,
      text: message,
    });

    status = 'sent';
    response_id = response?.data?.id || null;

    // Send confirmation to the user if applicable
    if (user_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      await resend.emails.send({
        from: 'QuickSites <sandon@contact.quicksites.ai>',
        to: [user_email],
        subject: 'Thanks for contacting us!',
        text: `Hi there,\n\nThanks for reaching out. We’ve received your message and will get back to you shortly.\n\n— The QuickSites Team`,
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
