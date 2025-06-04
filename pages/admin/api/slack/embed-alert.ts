// pages/api/slack/embed-alert.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const webhookUrl = process.env.SLACK_WEBHOOK_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { schema_id, count } = req.body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: schema, error: schemaError } = await supabase
    .from('schema_links')
    .select('slack_username')
    .eq('id', schema_id)
    .single();

  const userTag = schema?.slack_username ? `<@${schema.slack_username}>` : '';

  try {
    const payload = {
      text: `🚨 *Embed Traffic Spike*
      ${userTag}
      Schema: \`${schema_id}\`
      Views (24h): *${count}*
      Link: https://yourdomain.com/admin/zod-playground?schema_id=${schema_id}`,
    };

    const response = await fetch(webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Slack webhook failed');
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Slack alert failed', err);
    res.status(500).json({ error: 'Slack alert failed' });
  }
}
