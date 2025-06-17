import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data: queue } = await supabase
  .from('screenshot_queue')
  .select('*')
  .eq('status', 'pending')
  .order('requested_at')
  .limit(3);

for (const item of queue || []) {
  const domain = item.domain;
  console.log(`📸 Processing screenshot for ${domain}`);

  await supabase
    .from('screenshot_queue')
    .update({ status: 'processing' })
    .eq('id', item.id);

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });

    const output = path.join('public/screenshots', `${domain}.png`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await page.screenshot({ path: output });

    await browser.close();

    await supabase
      .from('screenshot_queue')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', item.id);
  } catch (err) {
    console.error('Failed to screenshot', domain);
    await supabase
      .from('screenshot_queue')
      .update({ status: 'failed' })
      .eq('id', item.id);
  }
}
