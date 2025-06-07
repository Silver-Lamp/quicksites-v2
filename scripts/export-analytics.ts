import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { formatISO, subDays } from 'date-fns';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const start = subDays(new Date(), 1);
const end = new Date();

async function exportAnalytics(table: string, dateColumn: string, filename: string) {
  const { data, error } = await supabase
    .from(table)
    .select(`${dateColumn}, site_id`)
    .gte(dateColumn, formatISO(start))
    .lte(dateColumn, formatISO(end));

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  const csv = ['date,site_id'].concat(
    data.map((row: any) => `${row[dateColumn].slice(0, 10)},${row.site_id || ''}`)
  ).join('\n');

  const outputDir = './reports/analytics';
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, csv);
  console.log(`✅ Exported ${data.length} rows to ${outputPath}`);
}

await exportAnalytics('published_site_views', 'viewed_at', `site-views_${formatISO(start, { representation: 'date' })}.csv`);
await exportAnalytics('site_events', 'created_at', `site-events_${formatISO(start, { representation: 'date' })}.csv`);


// Low traffic check + activity log
const logFile = './reports/activity.log';
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(line.trim());
};

log(`Exported ${data.length} rows from ${table}`);

if (table === 'published_site_views' && data.length < 10) {
  log('⚠️ LOW TRAFFIC WARNING: Less than 10 views in 24h');
}
