// scripts/posthog-traffic.mts
//
// Traffic for a set of pages, read from PostHog with a personal API key (read-only query scope).
//   npx tsx --env-file=.env.local scripts/posthog-traffic.mts [days=3] [path-substring ...]
// Defaults to the pages built 2026-10-10/11 (the salmon page, /spread-the-word, /for-sales …).
// Prints: views + unique visitors per path, the salmon-style breakdowns (by hour Pacific,
// referrer, Facebook click id, device, city), time on page from pageleaves, and which on-page
// buttons were clicked. Read-only; nothing is written anywhere.
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const HOST = (process.env.POSTHOG_API_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
const PROJECT = process.env.POSTHOG_PROJECT_ID || '378637';
if (!KEY) throw new Error('POSTHOG_PERSONAL_API_KEY is not set');

const args = process.argv.slice(2);
const days = Number(args[0]) > 0 ? Number(args[0]) : 3;
const paths = args.slice(1).length ? args.slice(1) : ['river-williams-smoked-salmon', 'spread-the-word', 'for-sales', 'lil-mamas', 'dirkse', 'harper-hobson', 'sugar-shack', 'eggnest'];

async function hogql(query: string): Promise<{ columns: string[]; results: unknown[][] }> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  return { columns: j.columns ?? [], results: j.results ?? [] };
}
function table(title: string, t: { columns: string[]; results: unknown[][] }) {
  console.log(`\n## ${title}`);
  if (!t.results.length) return console.log('  (none)');
  console.log('  ' + t.columns.join(' | '));
  for (const r of t.results) console.log('  ' + r.map((v) => (v === null || v === undefined ? '—' : String(v))).join(' | '));
}
const like = paths.map((p) => `properties.$current_url like '%${p.replace(/'/g, '')}%'`).join(' or ');
const since = `timestamp > now() - interval ${days} day`;
const pt = (col: string) => `toTimeZone(${col}, 'America/Los_Angeles')`;

table(`Views by page, last ${days} days`, await hogql(`
  select cutQueryStringAndFragment(properties.$current_url) as url, count() as views, count(distinct distinct_id) as visitors,
         min(${pt('timestamp')}) as first_pt, max(${pt('timestamp')}) as last_pt
  from events where event = '$pageview' and ${since} and (${like})
  group by url order by views desc limit 30`));

for (const p of paths) {
  const where = `event = '$pageview' and ${since} and properties.$current_url like '%${p}%'`;
  const { results } = await hogql(`select count() from events where ${where}`);
  if (!Number(results[0]?.[0])) continue;
  table(`${p} — by hour (Pacific)`, await hogql(`
    select toStartOfHour(${pt('timestamp')}) as hour_pt, count() as views, count(distinct distinct_id) as visitors
    from events where ${where} group by hour_pt order by hour_pt`));
  table(`${p} — where from`, await hogql(`
    select coalesce(nullif(properties.$referring_domain, ''), '(direct / none)') as referrer,
           if(properties.$current_url like '%fbclid%', 'yes', 'no') as fb_click_id,
           count() as views, count(distinct distinct_id) as visitors
    from events where ${where} group by referrer, fb_click_id order by views desc limit 12`));
  table(`${p} — device · city`, await hogql(`
    select coalesce(properties.$device_type, '?') as device, coalesce(properties.$geoip_city_name, '?') as city, coalesce(properties.$geoip_subdivision_1_code, '') as region,
           count() as views, count(distinct distinct_id) as visitors
    from events where ${where} group by device, city, region order by views desc limit 12`));
  table(`${p} — time on page (from pageleaves)`, await hogql(`
    select count() as leaves,
           round(avg(toFloat(properties.$prev_pageview_duration)), 1) as avg_seconds,
           round(quantile(0.5)(toFloat(properties.$prev_pageview_duration)), 1) as median_seconds,
           round(max(toFloat(properties.$prev_pageview_duration)), 1) as max_seconds
    from events where event = '$pageleave' and ${since} and properties.$prev_pageview_pathname like '%${p}%'`));
  table(`${p} — buttons and links clicked (autocapture)`, await hogql(`
    select coalesce(nullif(properties.$el_text, ''), coalesce(properties.$event_type, '?')) as element, count() as clicks, count(distinct distinct_id) as visitors
    from events where event = '$autocapture' and ${since} and properties.$current_url like '%${p}%'
    group by element order by clicks desc limit 15`));
}
