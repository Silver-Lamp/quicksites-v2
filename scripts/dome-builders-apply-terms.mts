// scripts/dome-builders-apply-terms.mts
//
// Bring every LIVE dome-builders directory page in line with DomeSketch's feed terms
// (lib/domeBuilders/domesketchFeed.ts — their reply of 2026-09-20): each DomeSketch-sourced
// entry reads "Listing from the DomeSketch builders directory" and links to their listing;
// weak-source orgs lose their summary; entries are alphabetical and the subtitle says so;
// the calculator CTA uses their canonical UTM. Walks ALL three content copies (CLAUDE.md
// §8), commits through the sanctioned RPC, republishes. Idempotent.
//
//   npx tsx scripts/dome-builders-apply-terms.mts            # dry run
//   npx tsx scripts/dome-builders-apply-terms.mts --apply

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

const APPLY = process.argv.includes('--apply');
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';

const norm = (n: string) =>
  n
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(inc|llc|corp|corporation|co|company)\b\.?/g, '')
    .replace(/[^a-z]/g, '');

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');
  const feed = await import('@/lib/domeBuilders/domesketchFeed');
  const orgs = (await feed.fetchDomesketchFeed()).orgs;
  const byName = new Map(orgs.map((o) => [norm(o.name), o]));
  console.log(`feed: ${orgs.length} orgs`);

  const { data: campaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, template_id')
    .eq('industry_key', 'dome_builder');
  for (const c of campaigns ?? []) {
    const { data: t } = await supabaseAdmin
      .from('templates')
      .select('id, data, rev')
      .eq('id', c.template_id)
      .maybeSingle();
    if (!t) continue;
    const data = JSON.parse(JSON.stringify(t.data));
    const before = JSON.stringify(data);
    const notes: string[] = [];
    for (const page of data.pages ?? []) {
      for (const arr of [page.blocks, page.content_blocks]) {
        for (const b of arr ?? []) {
          if (b?.type === 'hero') {
            for (const holder of [b.content, b.props]) {
              if (holder && typeof holder.cta_link === 'string' && /domesketch\.ai/.test(holder.cta_link)) {
                holder.cta_link = feed.calculatorUrl(c.domain);
              }
            }
          }
          if (b?.type !== 'builders_directory') continue;
          for (const holder of [b.content, b.props]) {
            if (!holder || !Array.isArray(holder.entries)) continue;
            let matched = 0;
            holder.entries = feed.sortAlphabetically(
              holder.entries.map((e: any) => {
                const fromDs = /domesketch/i.test(String(e.source_label ?? '')) || /domesketch\.ai/.test(String(e.source_url ?? ''));
                if (!fromDs) return e;
                const org = byName.get(norm(e.name));
                if (!org) {
                  notes.push(`no feed match for "${e.name}" — left as is`);
                  return e;
                }
                matched++;
                const f = feed.orgEntryFields(org);
                return { ...e, summary: f.summary, source_label: f.source_label, source_url: f.source_url };
              })
            );
            if (typeof holder.subtitle === 'string' && !holder.subtitle.includes(feed.DIRECTORY_ORDERING_NOTE)) {
              holder.subtitle = `${feed.DIRECTORY_ORDERING_NOTE} ${holder.subtitle}`.trim();
            }
            if (typeof holder.cta_link === 'string' && /domesketch\.ai/.test(holder.cta_link)) {
              holder.cta_link = feed.calculatorUrl(c.domain);
            }
            notes.push(`${matched} DomeSketch entries re-attributed`);
          }
        }
      }
    }
    if (JSON.stringify(data) === before) {
      console.log(`${c.domain}: no change`);
      continue;
    }
    console.log(`${c.domain}: ${[...new Set(notes)].join('; ')}${APPLY ? '' : ' (dry run)'}`);
    if (!APPLY) continue;
    await commitTemplatePatch(t.id, Number((t as any).rev ?? 0), { data }, OPERATOR_ID);
    const { error } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: t.id,
    });
    console.log(`${c.domain}: republished ${error ? 'FAILED ' + error.message : 'ok'}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
