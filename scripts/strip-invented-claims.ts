// scripts/strip-invented-claims.ts
//
// Replace scaffold FAQ answers that make claims on a business's behalf.
//
//   npx tsx --env-file=.env.local scripts/strip-invented-claims.ts          # dry run
//   npx tsx --env-file=.env.local scripts/strip-invented-claims.ts --write
//
// ⚠️ WHAT THIS CLEANS UP. The scaffold's FAQ asserted 'Yes — {business} is fully licensed and
// insured', plus response times, free-quote and payment policies — published under REAL, NAMED
// businesses that never asked for a site. The generator is fixed (industryCopy.ts + its guard test);
// these rows predate the fix.
//
// ⚠️ REPLACES, NEVER DELETES. An FAQ with the licensing question removed is less useful than one
// that says "ask us" — people genuinely want to know. The answer becomes an invitation, which is
// true by construction.
import { createClient } from '@supabase/supabase-js';
import { commitTemplatePatch } from '../lib/templates/commitTemplatePatch';

// ⚠️ QUESTION-KEYED, NOT ANSWER-KEYED, FOR THE LICENSING ONE.
// The first version matched the answer text 'is fully licensed and insured' — fitted to the single
// example I had read. It rewrote 298 answers, reported success, and left 24 templates untouched
// (one of them PUBLISHED) because those said "we're fully licensed and insured for your peace of
// mind" — a different wording from an older generator or the AI copy path. Matching the QUESTION
// catches every phrasing of the answer, including ones no longer in the codebase.
const ANSWER_BY_QUESTION: Array<[RegExp, RegExp, string]> = [
  [/licensed|insured/i, /licen[cs]ed|insured/i,
   'Ask us and we’ll confirm our current license and insurance details before any work starts.'],
];

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/In most cases we respond within the hour[^"]*/i,
   'Call and we’ll give you an honest ETA for your address.'],
  [/Yes\s*—?\s*we prioritize urgent jobs[^"]*/i,
   'Call us and we’ll tell you what we can do today.'],
  [/Reach out through the contact form or give us a call[^"]*no-obligation quote\./i,
   'Send a message through the contact form or give us a call, and we’ll get back to you.'],
  [/We provide a clear estimate before any work begins[^"]*/i,
   'Ask about pricing and payment when you get in touch and we’ll walk you through it.'],
  [/We use proven, property-safe methods[^"]*/i,
   'Ask us how we protect the surrounding area for the work you need.'],
  [/We’re upfront about costs[^"]*/i,
   'Ask about pricing when you get in touch and we’ll explain how it works for your job.'],
  [/We proudly serve the local area and surrounding communities[^"]*/i,
   'Get in touch and we’ll let you know whether we cover your neighborhood.'],
];

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Need NEXT_PUBLIC_SUPABASE_URL + a service-role key.');
  return createClient(url, key);
}

function fixBlocks(arr: any[]): number {
  let n = 0;
  for (const b of arr ?? []) {
    if (b?.type !== 'faq') continue;
    const bag = b.content ?? b.props;
    // ⚠️ THREE ITEM SHAPES, FOUND ONE AT A TIME BY BEING WRONG. `{question,answer}` is the current
    // one; older/AI-generated rows use `{q,a}`. The first pass reported 298 successes and left rows
    // behind purely because it only knew one shape — a clean success that missed, which is the
    // failure this repo keeps re-learning.
    for (const item of bag?.items ?? bag?.faqs ?? []) {
      const AK = typeof item?.answer === 'string' ? 'answer' : typeof item?.a === 'string' ? 'a' : null;
      const QK = typeof item?.question === 'string' ? 'question' : typeof item?.q === 'string' ? 'q' : null;
      if (!AK) continue;
      let done = false;
      // Question-keyed rules first — they catch every phrasing of the answer.
      for (const [qPattern, aPattern, replacement] of ANSWER_BY_QUESTION) {
        if (QK && qPattern.test(String(item[QK])) && aPattern.test(item[AK]) && item[AK] !== replacement) {
          item[AK] = replacement; n++; done = true; break;
        }
      }
      if (done) continue;
      for (const [pattern, replacement] of REPLACEMENTS) {
        if (pattern.test(item[AK])) { item[AK] = replacement; n++; break; }
      }
    }
  }
  return n;
}

async function main() {
  const write = process.argv.includes('--write');
  const s = db();
  const { data, error } = await s.from('templates').select('id,slug,template_name,claim_source,published,data,rev');
  if (error) throw new Error(error.message);

  let touched = 0, fixedRows = 0;
  for (const t of (data ?? []) as any[]) {
    const next = JSON.parse(JSON.stringify(t.data ?? {}));
    let n = 0;
    for (const page of next.pages ?? []) {
      for (const key of ['content_blocks', 'blocks'] as const) {
        if (Array.isArray(page[key])) n += fixBlocks(page[key]);
      }
    }
    if (!n) continue;
    touched += n;
    fixedRows++;
    const tag = `${t.claim_source ?? 'none'}${t.published ? ' · PUBLISHED' : ''}`;
    if (!write) { console.log(`  · ${t.template_name} [${tag}] — ${n} answer(s)`); continue; }
    const err = await commitTemplatePatch(t.id, t.rev, { data: next }, null);
    console.log(err ? `  ✗ ${t.template_name}: ${err}` : `  ✓ ${t.template_name} [${tag}] — ${n}`);
  }
  console.log(write ? `\nrewrote ${touched} answers across ${fixedRows} templates`
                    : `\nDRY RUN — ${touched} answers across ${fixedRows} templates. Pass --write`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
