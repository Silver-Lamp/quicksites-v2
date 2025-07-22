// /app/api/send-contact-email/route.ts
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, subject, message } = await req.json();

  if (!to?.length || !subject || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const response = await resend.emails.send({
      from: 'QuickSites Contact <contact@quicksites.ai>',
      to: Array.isArray(to) ? to : [to],
      subject,
      text: message,
    });

    return NextResponse.json({ success: true, id: response?.data?.id });
  } catch (err) {
    console.error('[Email error]', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
