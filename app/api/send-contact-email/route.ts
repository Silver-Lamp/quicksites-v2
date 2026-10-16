import { Resend } from 'resend';
import { lazyClient } from '@/lib/lazyClient';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { orgEmailBrand } from '@/lib/email';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { resolveContactRecipient, isEmail } from '@/lib/templates/contactRecipient';

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export async function POST(req: Request) {
  // Public site contact form → throttle per IP.
  const limited = await rateLimitOr429(req, 'contact_email', 10, 3600);
  if (limited) return limited;

  const {
    subject,
    message,
    user_email,
    site_slug,
    form_submission_id,
  } = await req.json();

  if (!subject || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Recipient is derived server-side from the site slug — never taken from the
  // request body — so this endpoint can't be used as an open email relay.
  if (!site_slug || typeof site_slug !== 'string') {
    return NextResponse.json({ error: 'Missing site_slug' }, { status: 400 });
  }
  // ⚠️ THE EMAIL'S FATE IS WRITTEN HERE, WITH THE SERVICE ROLE — never by the form. The form used
  // to `update form_submissions` with the anon key after this call; that UPDATE returns 204 and
  // changes NOTHING, because Postgres applies the SELECT policy (admin-only) to the rows an
  // UPDATE's WHERE must read. Measured 2026-10-16: 204, row unchanged. So every lead read
  // "no email" in the inbox whatever happened here.
  const submissionId = typeof form_submission_id === 'string' && /^[0-9a-f-]{36}$/i.test(form_submission_id) ? form_submission_id : null;
  const recordFate = async (email_status: string, email_response_id: string | null, email_error: string | null) => {
    if (!submissionId) return;
    try {
      await supabase.from('form_submissions').update({ email_status, email_response_id, email_error }).eq('id', submissionId);
    } catch (e) {
      console.warn('[send-contact-email] could not record fate', (e as any)?.message || e);
    }
  };

  const recipient = await resolveContactRecipient(supabase, site_slug);
  if (!recipient) {
    await recordFate('error', null, `No contact email is configured for site "${site_slug}"`);
    return NextResponse.json(
      { error: 'No contact email is configured for this site' },
      { status: 422 }
    );
  }
  const uniqueRecipients = [recipient];

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
    if (isEmail(user_email)) {
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
  await recordFate(status, response_id, error);

  if (status === 'error') {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: response_id });
}
