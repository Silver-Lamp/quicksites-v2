// scripts/outreach-candidates.ts
//
// Who may I write to, and what is on their page?
//
//   npm run outreach:candidates                  # the eligible list + why everyone else is out
//   npm run outreach:candidates -- --all         # include disqualified rows, with reasons
//   npm run outreach:candidates -- --detail <slug>   # full menu/hours/contact, for finding a hook
//
// ⚠️ IT FINDS PEOPLE. IT DOES NOT WRITE MESSAGES, and it must never learn to.
// See the header of `lib/outreach/candidates.ts` and the standing rule in docs/OUTREACH_FIVE.md.
// The message is the product; a template set is the thing the whole experiment is the opposite of.
//
// ⚠️ "Already contacted" is DERIVED from outreach_touches, never a list pasted into a script.
// The first two batches were excluded by a hardcoded array of ids, which is correct exactly once and
// silently wrong on the next run.
import { createClient } from '@supabase/supabase-js';
import {
  toCandidate,
  rankCandidates,
  summarizeExclusions,
  missingWeekdays,
  type Candidate,
} from '../lib/outreach/candidates';
import { readMenuSections } from '../lib/menu/menuBlocks';
import { detectSignals, sortSignals } from '../lib/outreach/draftSignals';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Standalone scripts don't get instrumentation.ts's SUPABASE_SECRET_KEY → SERVICE_ROLE mapping.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).');
    process.exit(1);
  }
  return createClient(url, key);
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}

async function detail(slug: string) {
  const s = db();
  const { data } = await s.from('templates').select('id,slug,template_name,data').eq('slug', slug).maybeSingle();
  if (!data) return console.error(`no template with slug ${slug}`);
  const d: any = data.data ?? {};
  const c = d?.meta?.contact ?? {};
  console.log(`\n${data.template_name}   [${data.id}]`);
  console.log(`  ${c.address ?? '—'} · ${c.city ?? '—'}, ${c.state ?? '—'} ${c.postal ?? ''}`);
  console.log(`  ${c.phone ?? 'NO PHONE'}`);
  console.log(`  live: https://deliveredmenu.com/${data.slug}`);

  const page = d?.pages?.[0] ?? {};
  const hours = [...(page.content_blocks ?? []), ...(page.blocks ?? [])].find((b: any) => b?.type === 'hours');
  const hoursContent = hours?.content ?? hours?.props;
  if (hoursContent?.days) {
    const listed = (hoursContent.days as any[]).map((d) => d?.label ?? d?.key).filter(Boolean);
    console.log(`  hours: ${listed.join(', ')}`);
    // A missing weekday is one of the best hooks available and is easy to miss by eye.
    const missing = missingWeekdays(hoursContent);
    if (missing.length) console.log(`  ⚠️ hours omit: ${missing.join(', ')}  ← ASK, do not assume closed`);
  } else {
    console.log('  ⚠️ no hours block at all');
  }

  const sections = readMenuSections(d);
  console.log(`\n  menu — ${sections.length} sections, ${sections.reduce((n, s2) => n + (s2.items?.length ?? 0), 0)} items`);
  const prices = new Set<string>();
  for (const sec of sections) {
    console.log(`   · ${(sec as any).name ?? (sec as any).title ?? '(untitled)'} (${sec.items?.length ?? 0})`);
    for (const it of sec.items ?? []) {
      if (it.price) prices.add(String(it.price));
      console.log(`       ${it.name ?? '?'}${it.price ? `  ${it.price}` : ''}${it.description ? `  — ${String(it.description).slice(0, 64)}` : ''}`);
    }
  }
  // ⚠️ The ad-hoc checks that used to live here are now lib/outreach/draftSignals.ts, so the CLI and
  // the operator screen cannot drift into disagreeing about what is wrong with a draft.
  const signals = sortSignals(detectSignals(d));
  if (signals.length) {
    console.log('\n  notable:');
    for (const sig of signals) {
      console.log(`   ${sig.severity === 'defect' ? '🔴' : '🔵'} ${sig.label}`);
      console.log(`      ${sig.detail}`);
    }
    console.log('\n  ⚠️ These are OBSERVATIONS, not copy. Read the page before writing anything.');
  }
}

async function main() {
  const slug = arg('detail');
  if (slug) return detail(slug);

  const s = db();
  const [{ data: drafts }, { data: touches }] = await Promise.all([
    s.from('templates').select('id,slug,template_name,data,industry').eq('claim_source', 'listing_import').is('owner_id', null).limit(1000),
    s.from('outreach_touches').select('template_id'),
  ]);
  const contactedIds = new Set((touches ?? []).map((t: any) => t.template_id).filter(Boolean));

  const candidates: Candidate[] = (drafts ?? []).map((d: any) => toCandidate(d, { contactedIds }));
  const sum = summarizeExclusions(candidates);

  console.log(`\nunclaimed listing_import drafts: ${sum.total}`);
  for (const [reason, n] of Object.entries(sum.byReason).sort((a, b) => b[1] - a[1])) {
    const note = reason === 'placeholder-menu' ? '  ← #738: invented menu under a real name. NEVER SEND.' : '';
    console.log(`  ${String(n).padStart(3)}  ${reason}${note}`);
  }
  console.log(`  ${String(sum.eligible).padStart(3)}  ELIGIBLE\n`);

  if (process.argv.includes('--all')) {
    for (const c of candidates.filter((c2) => c2.disqualified)) {
      console.log(`  [${c.disqualified}] ${c.name}  ${c.slug}`);
    }
    console.log('');
  }

  for (const c of rankCandidates(candidates)) {
    const material = c.items ? `${String(c.items).padStart(3)} items /${String(c.sections).padStart(2)} sec` : `${String(c.industry ?? 'service').slice(0, 14).padEnd(14)}`;
    console.log(`  ${material}  ${(c.city ?? '?').padEnd(12)} ${(c.phone ?? '').padEnd(16)} ${c.name}`);
    console.log(`       https://deliveredmenu.com/${c.slug}`);
  }
  if (!sum.eligible) {
    console.log('  none. A new city sweep spends Places budget — an owner decision, not a session one.');
  }
  console.log('\nNext: --detail <slug> on each, find ONE verified hook per business, write by hand.');
  console.log('Method: docs/OUTREACH_METHOD.md\n');
}

main();
