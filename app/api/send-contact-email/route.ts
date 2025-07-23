import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, subject, message, user_email } = await req.json();

  if (!to?.length || !subject || !message) {
    console.log('Missing required fields', to, subject, message);
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // 1. Send to notification list
    const response = await resend.emails.send({
      from: 'QuickSites Contact <sandon@contact.quicksites.ai>',
      to: Array.isArray(to) ? to : [to],
      subject,
      text: message,
    });

    // 2. Send confirmation to the user (if provided and valid)
    if (user_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      await resend.emails.send({
        from: 'QuickSites <sandon@contact.quicksites.ai>',
        to: [user_email],
        subject: 'Thanks for contacting us!',
        text: `Hi there,\n\nThanks for reaching out. We’ve received your message and will get back to you shortly.\n\n— The QuickSites Team`,
      });
    }

    return NextResponse.json({ success: true, id: response?.data?.id });
  } catch (err) {
    console.error('[Email error]', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
