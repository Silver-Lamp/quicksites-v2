import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const logPath = './reports/activity.log';
const contents = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
const lastLine = contents.at(-1) || '';

if (!lastLine.includes('Exported')) {
  console.log('No export event found, skipping webhook');
  process.exit(0);
}

const { data, error } = await supabase.from('report_webhooks').select('*').eq('enabled', true);

if (error) {
  console.error('Error fetching webhooks', error);
  process.exit(1);
}

for (const hook of data) {
  try {
    await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(hook.secret_token && {
          Authorization: `Bearer ${hook.secret_token}`,
        }),
      },
      body: JSON.stringify({
        event: 'export.success',
        summary: lastLine,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log(`📤 Notified ${hook.url}`);
  } catch (e: any) {
    console.error(`❌ Failed to notify ${hook.url}:`, e instanceof Error ? e.message : String(e));
  }
}
