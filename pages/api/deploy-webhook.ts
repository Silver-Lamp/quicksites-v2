export default async function handler(req, res) {
  const { domain } = JSON.parse(req.body);

  const webhook = process.env.VERCEL_DEPLOY_WEBHOOK;
  if (!webhook || !domain) {
    return res.status(400).json({ error: 'Missing info' });
  }

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });

  return res.status(200).json({ triggered: true });
}
