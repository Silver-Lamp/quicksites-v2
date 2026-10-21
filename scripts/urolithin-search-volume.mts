// scripts/urolithin-search-volume.mts — ONE paid DataForSEO Google Ads volume task (US, ~$0.09) plus
// THREE organic SERP reads (~$0.01) for the urolithin A / mitochondria query family.
// docs/LONGEVITY_PLAN.md §9 cites it; re-run rather than trusting the table.
//   npx tsx --env-file=.env.local scripts/urolithin-search-volume.mts
const KW = [
  'urolithin a', 'urolithin a supplement', 'best urolithin a supplement', 'urolithin a benefits', 'urolithin a side effects',
  'urolithin a reviews', 'mitopure', 'mitopure reviews', 'timeline mitopure', 'timeline nutrition', 'mitopure gummies',
  'urolithin a vs nmn', 'urolithin a dosage', 'urolithin a pomegranate', 'urolithin a amazon', 'urolithin a muscle',
  'mitochondria supplement', 'mitochondrial health supplements', 'best supplements for mitochondria', 'mitophagy supplement',
  'nmn supplement', 'nad supplement', 'nr supplement', 'coq10 benefits', 'pqq supplement', 'mitoq',
  'red light therapy', 'red light therapy benefits', 'red light therapy for hair loss', 'red light therapy panel', 'red light therapy near me',
  'sound bath', 'sound bath near me', 'sound therapy', 'singing bowls', '528 hz',
];
const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const post = (path: string, body: unknown) =>
  fetch(`https://api.dataforseo.com/v3/${path}`, { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<any>);

const vol = await post('keywords_data/google_ads/search_volume/live', [{ keywords: KW, location_code: 2840, language_code: 'en' }]);
console.log(`volume: ${vol?.tasks?.[0]?.status_message} · $${vol?.cost}`);
const rows = (vol?.tasks?.[0]?.result ?? []).map((x: any) => ({ kw: x.keyword, v: x.search_volume ?? 0, cpc: x.cpc, comp: x.competition }));
rows.sort((a: any, b: any) => b.v - a.v);
for (const x of rows) console.log(`${String(x.v).padStart(7)}  $${x.cpc == null ? '  -  ' : Number(x.cpc).toFixed(2).padStart(5)}  ${String(x.comp ?? '-').padEnd(7)} ${x.kw}`);

for (const q of ['urolithin a supplement', 'mitopure reviews', 'best supplements for mitochondria']) {
  const s = await post('serp/google/organic/live/advanced', [{ keyword: q, location_code: 2840, language_code: 'en', depth: 10 }]);
  const items = s?.tasks?.[0]?.result?.[0]?.items ?? [];
  const blocks = items.map((i: any) => i.type);
  const organic = items.filter((i: any) => i.type === 'organic').slice(0, 8).map((i: any) => `${i.rank_absolute}. ${i.domain}`);
  console.log(`\nSERP "${q}" · $${s?.cost} · blocks: ${[...new Set(blocks)].join(', ')}`);
  console.log('  ' + organic.join(' | '));
}
