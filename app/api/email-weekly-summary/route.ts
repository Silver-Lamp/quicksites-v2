// app/api/email-weekly-summary/route.ts

export const runtime = 'nodejs'; // Ensures Node-compatible runtime for `nodemailer`

import { json } from '@/lib/api/json';
import nodemailer from 'nodemailer';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { summary, userEmail } = body;

    if (!summary || !Array.isArray(summary)) {
      return json({ message: 'Invalid summary data' }, 400);
    }

    const csv =
      'week,count\n' +
      summary.map(([week, count]: [string, number]) => `${week},${count}`).join('\n');

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASS,
      },
    });

    const mailOptions = {
      from: 'Weekly Reports <noreply@yourapp.com>',
      to: process.env.REPORT_RECIPIENT_EMAIL || 'admin@yourapp.com',
      subject: '📊 Weekly Deployment Summary',
      html: `<p>Weekly summary sent by: <strong>${userEmail}</strong></p><p>See attached CSV.</p>`,
      attachments: [
        {
          filename: 'weekly-summary.csv',
          content: csv,
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    return json({ message: 'Summary email sent successfully!' });
  } catch (err: any) {
    console.error('[EMAIL ERROR]', err);
    return json({ message: 'Failed to send email' }, 500);
  }
}
