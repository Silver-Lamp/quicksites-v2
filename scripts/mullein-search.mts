// scripts/mullein-search.mts — ONE paid Google Ads volume task (US, ~$0.09) + SERP reads (~$0.002 each)
// for the mullein query family. docs/LONGEVITY_PLAN.md §12 cites it; re-run rather than trusting the table.
//   npx tsx --env-file=.env.local scripts/mullein-search.mts
const KW = [
  'mullein', 'mullein tea', 'mullein benefits', 'mullein drops', 'mullein tincture', 'mullein gummies', 'mullein supplement',
  'mullein for lungs', 'mullein for cough', 'mullein side effects', 'does mullein work', 'is mullein safe', 'mullein for smokers',
  'mullein lungs smokers', 'mullein lung detox', 'mullein for copd', 'mullein for asthma', 'mullein study', 'mullein research',
  'mullein clinical trial', 'mullein dosage', 'mullein capsules', 'mullein smoke', 'smoking mullein', 'best mullein drops',
  'mullein gummies benefits', 'mullein leaf tea benefits', 'mullein and lungs', 'how long does it take for mullein to work',
];
const SERPS = ['mullein benefits', 'mullein for lungs', 'mullein drops', 'mullein gummies', 'mullein side effects', 'does mullein work', 'mullein for smokers'];
const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const post = (p: string, b: unknown) => fetch(`https://api.dataforseo.com/v3/${p}`, { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json() as Promise<any>);
const v = await post('keywords_data/google_ads/search_volume/live', [{ keywords: KW, location_code: 2840, language_code: 'en' }]);
console.log(`volume $${v.cost}`);
for (const x of (v.tasks?.[0]?.result ?? []).sort((a: any, b: any) => (b.search_volume ?? 0) - (a.search_volume ?? 0))) console.log(`${String(x.search_volume ?? 0).padStart(7)}  $${x.cpc == null ? '  -  ' : Number(x.cpc).toFixed(2)}  ${String(x.competition ?? '-').padEnd(6)} ${x.keyword}`);
for (const q of SERPS) {
  const s = await post('serp/google/organic/live/advanced', [{ keyword: q, location_code: 2840, language_code: 'en', depth: 10 }]);
  const items = s?.tasks?.[0]?.result?.[0]?.items ?? [];
  console.log(`\nSERP "${q}" · blocks: ${[...new Set(items.map((i: any) => i.type))].join(', ')}`);
  console.log('  ' + items.filter((i: any) => i.type === 'organic').slice(0, 9).map((i: any) => `${i.rank_absolute}.${i.domain}`).join(' | '));
}
