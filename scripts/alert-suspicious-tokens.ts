import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const webhook = process.env.SLACK_WEBHOOK;

const { data, error } = await supabase.from('token_logs').select('*');

if (error) {
  console.error('Failed to fetch logs');
  process.exit(1);
}

const tokenCounts = data.reduce((acc, log) => {
  acc[log.token_hash] = (acc[log.token_hash] || 0) + 1;
  return acc;
}, {});
for (const [hash, count] of Object.entries(tokenCounts)) {
  if (typeof count === 'number' && count > 5) {
    const alert = {
      text: `⚠️ Token used ${count} times: hash ${hash}`,
    };
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
      console.log(`🚨 Alert sent for hash ${hash}`);
    }
  }
}
