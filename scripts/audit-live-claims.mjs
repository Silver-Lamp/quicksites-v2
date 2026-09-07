#!/usr/bin/env node
// scripts/audit-live-claims.mjs
//
// What operational claims do our LIVE sites still make? Read-only.
//
//   npx tsx scripts/audit-live-claims.mjs            # published sites
//   npx tsx scripts/audit-live-claims.mjs --drafts   # include unpublished
//
// ⚠️ THREE BUCKETS, NOT ONE NUMBER. The first version of this audit reported "81 sites carry 348
// claim strings", and that figure was four things wearing one number:
//   1. real claims — availability, licensing, response time, guarantees, tenure;
//   2. pricing INVITATIONS in marketing copy ("Get a free quote") — #906 decided these are the same
//      thing as the CTA button beside them and left them, deliberately;
//   3. reader advice the regex cannot tell from a claim ("Battery Age Over 3 Years", "day or
//      night" said to a driver) — excluded by name in lib/rebuild/liveClaimRewrites.ts with a reason;
//   4. questions — "Do you offer 24/7 service?" is a fine thing to be asked.
// Only the first is the headline. The others are still printed, so nothing is hidden by the split.
//
// Before reporting a count, read three of the strings it counted (handoff 2026-09-07) — so each
// bucket prints samples, and the run fails if the scan matched no sites at all.
import { scrubText, makesOperationalClaim, claimKind } from '../lib/rebuild/scrubInventedClaims.ts';
import { isReaderAdvice } from '../lib/rebuild/liveClaimRewrites.ts';
import { loadEnv, makeRest } from './lib/republishTemplate.mjs';

const INCLUDE_DRAFTS = process.argv.includes('--drafts');
const rest = makeRest(loadEnv());
const rows = await rest(`templates?select=id,slug,published,data${INCLUDE_DRAFTS ? '' : '&published=eq.true'}&limit=400`);
if (!rows.length) throw new Error('scanned zero templates — a sweep matching nothing reports success');

/** Walk every string in the tree — a fourth copy appearing later must not defeat the sweep (§8). */
function walkStrings(node, fn) {
  if (Array.isArray(node)) return node.forEach((v) => walkStrings(v, fn));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') fn(v, k);
      else walkStrings(v, fn);
    }
  }
}

const ANSWER_FIELDS = new Set(['answer', 'a']);

/** Split a possibly-HTML string into the claim-bearing sentences inside it, so a 20 kB blog post is judged segment by segment. */
function claimSegments(s) {
  const parts = s.split(/<[^>]+>|\n+/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) for (const sent of p.match(/[^.!?]+[.!?]*/g) ?? []) if (makesOperationalClaim(sent)) out.push(sent.trim());
  return out;
}

const buckets = { claim: [], pricing: [], advice: [] };
for (const t of rows) {
  walkStrings(t.data, (s, key) => {
    if (key === 'question' || key === 'q') return;
    if (s.trim().endsWith('?')) return;
    if (!makesOperationalClaim(s)) return;
    for (const seg of claimSegments(s)) {
      const kind = claimKind(seg);
      const hit = { slug: t.slug, published: t.published, key, kind, seg: seg.slice(0, 140), after: scrubText(seg).text.slice(0, 140) };
      if (isReaderAdvice(seg)) buckets.advice.push(hit);
      else if (kind === 'pricing' && !ANSWER_FIELDS.has(key)) buckets.pricing.push(hit);
      else buckets.claim.push(hit);
    }
  });
}

function summarize(name, hits, note) {
  const sites = new Set(hits.map((h) => h.slug)).size;
  console.log(`\n${name}: ${hits.length} string${hits.length === 1 ? '' : 's'} on ${sites} site${sites === 1 ? '' : 's'}${note ? ` — ${note}` : ''}`);
  const byKey = new Map();
  for (const h of hits) byKey.set(`${h.key} / ${h.kind}`, (byKey.get(`${h.key} / ${h.kind}`) ?? 0) + 1);
  for (const [k, n] of [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ${String(n).padStart(4)}  ${k}`);
  // Three of the strings actually counted — never report a count without reading what it counted.
  const seen = new Set();
  for (const h of hits) {
    if (seen.size >= 3 || seen.has(h.seg)) continue;
    seen.add(h.seg);
    console.log(`   · [${h.slug}${h.published ? '' : ' draft'} ${h.key}] ${h.seg}`);
  }
}

summarize('REAL CLAIMS', buckets.claim);
summarize('pricing invitations in marketing copy', buckets.pricing, 'kept by #906’s decision; same as the CTA button beside them');
summarize('reader advice, not a claim about the business', buckets.advice, 'excluded by name, with a reason, in liveClaimRewrites.ts');

const claimSites = new Set(buckets.claim.map((h) => h.slug));
console.log(`\nHeadline: ${claimSites.size} site${claimSites.size === 1 ? '' : 's'} carry ${buckets.claim.length} operational claim${buckets.claim.length === 1 ? '' : 's'} (scanned ${rows.length} templates).`);
if (buckets.claim.length) {
  console.log('Fix path: scripts/rename-live-claims.mjs (curated) or scripts/scrub-live-claims.mjs (answers/subheadlines).');
}
console.log('Read-only. Nothing written.');
