// scripts/bluezones-search-volume.mts — ONE paid Google Ads volume task (US, ~$0.09) + two SERP reads for the Blue Zones query family. docs/LONGEVITY_PLAN.md §14 cites it.
//   npx tsx --env-file=.env.local scripts/bluezones-search-volume.mts
const KW = ['blue zones', 'blue zone diet', 'blue zones diet', 'blue zones recipes', 'blue zones kitchen', 'blue zones book', 'blue zones meal plan',
  'what are the blue zones', 'blue zones list', 'blue zones power 9', 'blue zones longevity', 'blue zones debunked', 'blue zones myth', 'blue zones fake',
  'blue zones netflix', 'live to 100 secrets of the blue zones', 'blue zones bean recipes', 'blue zone breakfast', 'blue zones project', 'blue zones challenge',
  'blue zones supplements', 'okinawa diet', 'sardinia longevity', 'ikaria diet', 'loma linda longevity', 'longevity diet'];
const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const r: any = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify([{ keywords: KW, location_code: 2840, language_code: 'en' }]) }).then((x) => x.json());
console.log(`$${r.cost}`);
for (const x of (r.tasks?.[0]?.result ?? []).sort((a: any, b: any) => (b.search_volume ?? 0) - (a.search_volume ?? 0))) console.log(`${String(x.search_volume ?? 0).padStart(7)}  $${x.cpc == null ? '  -  ' : Number(x.cpc).toFixed(2)}  ${x.keyword}`);
for (const q of ['blue zones debunked', 'blue zone diet']) {
  const s: any = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify([{ keyword: q, location_code: 2840, language_code: 'en', depth: 10 }]) }).then((x) => x.json());
  const items = s?.tasks?.[0]?.result?.[0]?.items ?? [];
  console.log(`\nSERP "${q}": ` + items.filter((i: any) => i.type === 'organic').slice(0, 8).map((i: any) => i.domain).join(' | '));
}
