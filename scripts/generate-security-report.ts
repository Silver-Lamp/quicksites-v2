import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const log = fs.readFileSync('./reports/security.log', 'utf-8');
const date = new Date().toISOString().slice(0, 10);
const html = `
  <html>
    <head>
      <style>
        body { font-family: monospace; background: #111; color: #eee; padding: 2rem; }
        h1 { color: #0df; }
        pre { background: #000; padding: 1rem; border-radius: 6px; }
      </style>
    </head>
    <body>
      <h1>🔐 Security Report - ${date}</h1>
      <pre>${log.replace(/</g, '&lt;')}</pre>
    </body>
  </html>
`;

const outDir = './reports/security';
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const filePath = path.join(outDir, `security-report-${date}.pdf`);
  await page.pdf({ path: filePath, format: 'A4' });
  await browser.close();
  console.log('✅ Saved', filePath);
})();


import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const buffer = fs.readFileSync(filePath);
const uploadPath = `security-reports/security-report-${date}.pdf`;

await supabase.storage
  .from('security-reports')
  .upload(uploadPath, buffer, {
    upsert: true,
    contentType: 'application/pdf'
  });

console.log('📤 Uploaded to Supabase:', uploadPath);
