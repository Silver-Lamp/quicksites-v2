// scripts/stemcell-search-volume.mts — ONE paid DataForSEO Google Ads search-volume task (US, ~$0.09) for the stem-cell / longevity query family. docs/LONGEVITY_PLAN.md §5 cites its output; re-run rather than trusting the table.
// ⚠️ A zero is NOT "no searches": Google has refused ads for unproven stem cell therapy since 2019-09-06, and Ads volume comes back empty for most of these terms.
//   npx tsx --env-file=.env.local scripts/stemcell-search-volume.mts
const KW = [
  'stem cell therapy near me', 'stem cell therapy', 'stem cell therapy cost', 'stem cell therapy for knees',
  'stem cell therapy for knees near me', 'stem cell injections near me', 'stem cell therapy for back pain',
  'stem cell therapy for neuropathy', 'stem cell therapy for parkinsons', 'stem cell therapy for ms',
  'stem cell therapy for copd', 'stem cell therapy for autism', 'stem cell therapy mexico', 'stem cell therapy panama',
  'is stem cell therapy fda approved', 'stem cell therapy scam', 'stem cell therapy reviews', 'stem cell therapy covered by insurance',
  'stem cell supplements', 'stem cell supplement', 'stemregen', 'stemregen reviews', 'stem cell activator',
  'natural ways to increase stem cells', 'how to increase stem cells naturally', 'stem cell nutrition',
  'stem cell therapy washington', 'stem cell therapy seattle', 'stem cell therapy florida', 'stem cell therapy texas',
  'stem cell therapy arizona', 'stem cell therapy california', 'stem cell therapy utah', 'stem cell therapy colorado',
  'stem cell therapy new york', 'stem cell therapy las vegas', 'stem cell therapy dallas', 'stem cell therapy houston',
  'longevity clinic near me', 'longevity supplements', 'citizen science health study', 'self experiment supplement',
];
const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const r = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
  method: 'POST',
  headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
  body: JSON.stringify([{ keywords: KW, location_code: 2840, language_code: 'en' }]),
});
const j: any = await r.json();
const task = j?.tasks?.[0];
console.log(`status ${task?.status_code} ${task?.status_message} · cost $${j?.cost}`);
const rows = (task?.result ?? []).map((x: any) => ({ kw: x.keyword, vol: x.search_volume ?? 0, cpc: x.cpc ?? null, comp: x.competition ?? null }));
rows.sort((a: any, b: any) => b.vol - a.vol);
for (const x of rows) console.log(`${String(x.vol).padStart(7)}  $${x.cpc == null ? '  -  ' : x.cpc.toFixed(2).padStart(5)}  ${String(x.comp ?? '-').padEnd(7)}  ${x.kw}`);
