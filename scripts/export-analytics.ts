import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { formatISO, subDays } from 'date-fns';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const start = subDays(new Date(), 1);
const end = new Date();

const logFile = './reports/activity.log';
const log = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(line.trim());
};

async function exportAnalytics(table: string, dateColumn: string, filename: string): Promise<void> {
  const { data, error } = await supabase
    .from<any, { [key: string]: string }>(table) // ← generic fallback, or use a named type
    .select(`${dateColumn}, site_id`)
    .gte(dateColumn, formatISO(start))
    .lte(dateColumn, formatISO(end));

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  const csv = ['date,site_id']
    .concat(
      (data || []).map(
        (row: { [key: string]: any }) =>
          `${row[dateColumn]?.slice(0, 10) || ''},${row.site_id || ''}`
      )
    )
    .join('\n');

  const outputDir = './reports/analytics';
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, csv);

  log(`✅ Exported ${data?.length || 0} rows from ${table} to ${outputPath}`);

  if (table === 'published_site_views' && (data?.length || 0) < 10) {
    log('⚠️ LOW TRAFFIC WARNING: Less than 10 views in 24h');
  }
}

await exportAnalytics(
  'published_site_views',
  'viewed_at',
  `site-views_${formatISO(start, { representation: 'date' })}.csv`
);

await exportAnalytics(
  'site_events',
  'created_at',
  `site-events_${formatISO(start, { representation: 'date' })}.csv`
);
