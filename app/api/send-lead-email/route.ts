export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdmin } from '@/lib/auth/requireUser';

export async function POST(req: NextRequest) {
  // This sends an email to an arbitrary caller-supplied recipient from the
  // platform mailbox — it was fully unauthenticated (an open relay). Restrict to
  // platform admins.
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { to, subject, text } = await req.json();

    if (!to || !subject || !text) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email send failed:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
