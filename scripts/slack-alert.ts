import fetch from 'node-fetch';

export async function sendSlackAlert(message: string) {
  const webhook = process.env.SLACK_WEBHOOK!;
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}
