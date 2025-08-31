// scripts/workers/screenshot-worker.ts

import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data: queue, error } = await supabase
  .from('screenshot_queue')
  .select('*')
  .eq('status', 'pending')
  .order('requested_at')
  .limit(5);

if (error) {
  console.error('❌ Failed to fetch queue:', error.message);
  process.exit(1);
}

for (const item of queue || []) {
  const domain = item.domain;
  console.log(`📸 Processing screenshot for ${domain}...`);

  await supabase.from('screenshot_queue').update({ status: 'processing' }).eq('id', item.id);

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });

    const outputDir = path.join(process.cwd(), 'public', 'screenshots');
    const outputPath = path.join(outputDir, `${domain}.png`);

    fs.mkdirSync(outputDir, { recursive: true });
    await page.screenshot({ path: outputPath as any, fullPage: true });
    await browser.close();

    await supabase
      .from('screenshot_queue')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', item.id);

    console.log(`✅ Screenshot saved to ${outputPath}`);
  } catch (err) {
    console.error(`❌ Failed to process ${domain}:`, err);
    await supabase.from('screenshot_queue').update({ status: 'failed' }).eq('id', item.id);
  }
}
