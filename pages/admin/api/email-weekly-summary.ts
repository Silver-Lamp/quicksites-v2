// pages/api/email-weekly-summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import { Transport } from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { summary, userEmail } = req.body;
    if (!summary || !Array.isArray(summary)) {
      return res.status(400).json({ message: 'Invalid summary data' });
    }

    const csv = 'week,count\n' + summary.map(([week, count]: [string, number]) => `${week},${count}`).join('\n');

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
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
    return res.status(200).json({ message: 'Summary email sent successfully!' });
  } catch (err) {
    console.error('[EMAIL ERROR]', err);
    return res.status(500).json({ message: 'Failed to send email' });
  }
}
