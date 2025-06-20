// In /pages/api/send-lead-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import nodemailer from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' });
  }

  const { to, subject, text } = req.body;

  try {
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

    json({ success: true });
  } catch (error) {
    console.error('Email send failed:', error);
    json({ error: 'Failed to send email' });
  }
}

// Make sure to add these environment variables in your .env.local:
// EMAIL_USER=your.email@example.com
// EMAIL_PASS=your_email_password_or_app_password
