// pages/api/slack/notify-access-request.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';

const webhookUrl = process.env.SLACK_WEBHOOK_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, org, role, status, message, id } = req.body;

  try {
    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔐 Access Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Email:*
${email}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*
${status.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Org:*
${org || '—'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Role:*
${role || '—'}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:* ${message || '—'}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Approve' },
              style: 'primary',
              value: `approve:${id}`,
              action_id: 'approve_request',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Reject' },
              style: 'danger',
              value: `reject:${id}`,
              action_id: 'reject_request',
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Slack webhook failed');
    json({ success: true });
  } catch (err) {
    console.error('Slack notify error:', err);
    json({ error: 'Failed to notify Slack' });
  }
}
