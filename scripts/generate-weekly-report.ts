import fs from 'node:fs';
import path from 'node:path';
import { format, subDays } from 'date-fns';
import puppeteer from 'puppeteer';

const baseDir = './reports/analytics';
const days = 7;
const outputDate = format(new Date(), 'yyyy-MM-dd');
const outputHtml = `${baseDir}/summary_${outputDate}.html`;
const outputPdf = `${baseDir}/summary_${outputDate}.pdf`;

function loadCsvContent(filePath: string): string {
  const rows = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  return rows
    .slice(1)
    .map((row) => {
      const [date, site_id] = row.split(',');
      return `<tr><td>${date}</td><td>${site_id}</td></tr>`;
    })
    .join('');
}

const htmlHeader = `<!DOCTYPE html>
<html><head><style>
  body { font-family: sans-serif; padding: 2rem; background: #f8f9fa; }
  h1 { color: #333; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
</style></head><body>
<h1>📊 Weekly Analytics Summary</h1>`;

const htmlFooter = '</body></html>';

(async () => {
  const files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.csv'));
  const recentFiles = files.filter((f) => {
    const match = f.match(/_(\d{4}-\d{2}-\d{2})\.csv$/);
    if (!match) return false;
    const date = new Date(match[1]);
    return date >= subDays(new Date(), days);
  });

  let sections = '';

  for (const file of recentFiles) {
    const title = file.replace('.csv', '');
    const body = loadCsvContent(path.join(baseDir, file));
    sections += `<h2>${title}</h2><table><tr><th>Date</th><th>Site ID</th></tr>${body}</table>`;
  }

  const fullHtml = htmlHeader + sections + htmlFooter;
  fs.writeFileSync(outputHtml, fullHtml);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outputPdf, format: 'a4' });
  await browser.close();

  console.log(`✅ Weekly summary generated: ${outputPdf}`);
})();

// Upload PDF to Supabase Storage
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const filename = `weekly/summary_${outputDate}.pdf`;
const pdfBuffer = fs.readFileSync(outputPdf);

await supabase.storage.from('analytics-exports').upload(filename, pdfBuffer, {
  upsert: true,
  contentType: 'application/pdf',
  cacheControl: '3600',
});

console.log(`📤 Uploaded summary to Supabase: ${filename}`);
