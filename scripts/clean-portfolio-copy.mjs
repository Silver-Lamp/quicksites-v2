#!/usr/bin/env node
// scripts/clean-portfolio-copy.mjs
//
// Strip invented promises and fabricated testimonials from the OLDER towing/service portfolio —
// the long-lived sites behind /proof/rankings — then republish and verify.
//
//   node scripts/clean-portfolio-copy.mjs                 # dry run over every older site
//   node scripts/clean-portfolio-copy.mjs --apply
//   node scripts/clean-portfolio-copy.mjs --apply --only arab-towing
//
// #851 did this for the 32 new geo sites. This set is older, it RANKS, and its copy is worse:
// 19 sites promise "available 24/7", 19 promise "we accept all major credit cards", 12 assert
// "fully licensed and insured", several promise arrival "within 30 minutes in <City>", and there
// are 33 testimonial blocks. Every one of these is a claim about a business that does not exist,
// on a page intended to be rented to a real operator who would inherit it.
//
// ⚠️ THE PHRASING IS NOT THE SAME AS THE GEO SCAFFOLD'S, so the map below was built by enumerating
// every FAQ answer in THIS set rather than reusing #851's. Assuming the two matched is exactly the
// sample-and-generalise error that cost two rounds on the geo batch.
//
// ⚠️ WHERE THE REPLACEMENTS COME FROM: the hedged variants already exist in the codebase — 7 of
// these templates already carry "Ask us and we'll confirm our current license…". This normalises
// to copy the project already produces. Nothing here is newly written marketing.
//
// ⚠️ ARRIVAL TIMES ARE THE WORST OF IT. "We usually arrive within 30 minutes in Covington, WA" is
// concrete, checkable, and false — there is no truck. It is also city-specific, so it needs a
// pattern rather than a literal.

import fs from 'node:fs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(body?.message || `${res.status} ${String(text).slice(0, 200)}`);
  return body;
}

const ETA = 'Call and we’ll give you an honest ETA for your address.';
const PAY = 'Ask about pricing and payment when you get in touch and we’ll walk you through it.';
const LIC =
  'Ask us and we’ll confirm our current license and insurance details before any work starts.';
const TODAY = 'Call us and we’ll tell you what we can do today.';

const HONEST = [
  // ⚠️ KEYWORD-PRESERVING BY DESIGN. These pages rank, so the replacements keep the city and trade
  // words and remove only the PROMISE. "We usually arrive within 30 minutes in Spanaway, WA" and
  // "Call and we'll give you an honest ETA for your address in Spanaway, WA" carry the same terms;
  // one is a commitment nobody can keep and the other isn't. Dropping the geo token as well would
  // be paying an SEO cost the honesty fix does not require.
  //
  // availability — keeps the service words from the original sentence
  [
    /Yes,?\s*we(?:'|’)?re available 24\/7 for all ([^".]*?) needs\./gi,
    'Call us about $1 — we’ll tell you what we can do today.',
  ],
  [/Yes,?\s*we(?:'|’)?re available 24\/7[^".]*\./gi, TODAY],
  // ⚠️ NO BLANKET "24/7" REPLACEMENT. The first cut rewrote every occurrence and produced
  // "ready around the clock where we can to help you" and — worse — mangled a FAQ *question*
  // ("Do you offer around the clock where we can service?"). A question is not a claim, and the
  // answer beneath it is already hedged. It also reached into blog posts.
  [/,?\s*ready 24\/7 to help you/gi, ''],
  [/24\/7 Emergency Assistance Anywhere in Town/gi, 'Emergency Assistance'],
  // payment
  [/We accept all major credit cards[^".]*\./gi, PAY],
  [/No,? we offer free estimates[^".]*\./gi, PAY],
  [
    /We provide a clear estimate before any work begins and accept all major payment methods\./g,
    PAY,
  ],
  // licensure
  [/Yes,?\s*we(?:'|’)?re fully licensed and insured[^".]*\./gi, LIC],
  [/Yes\s*[—-]\s*[^".]{0,60}? is fully licensed and insured[^".]*\./gi, LIC],
  // arrival-time promises — city captured and carried through
  [
    /We usually arrive within \d+ minutes in ([^".]+?) and nearby areas\./gi,
    'Call and we’ll give you an honest ETA for your address in $1.',
  ],
  [/We usually arrive within \d+ minutes[^".]*\./gi, ETA],
  [/Our team typically (?:responds|reaches your location) within[^".]*\./gi, ETA],
  [/In most cases we respond within the hour\.\s*/gi, ''],
  // guarantees
  [/Yes,?\s*we (?:stand by our work and )?guarantee[^".]*\./gi, TODAY],
  // shared with the geo scaffold
  [
    /Reach out through the contact form or give us a call [—-] we’ll get back to you quickly with a free, no-obligation quote\./g,
    'Send a message through the contact form or give us a call, and we’ll get back to you.',
  ],
];

// ⚠️ Deliberately NOT /24\/7/ — after the targeted rules above, a remaining "24/7" is either a
// FAQ question or blog prose, neither of which is a claim the business makes about itself. A
// residual check that fires on correct copy is one people learn to ignore.
const RESIDUAL = [
  /all major credit cards/i,
  /fully licensed and insured/i,
  /arrive within \d+ minutes/i,
  /we guarantee/i,
  /available 24\/7/i,
  /"type"\s*:\s*"testimonial"/,
];

function walkStrings(node, fn) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === 'string') node[i] = fn(v);
      else walkStrings(v, fn);
    });
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string') node[k] = fn(v);
      else walkStrings(v, fn);
    }
  }
}
function stripTestimonials(data) {
  let n = 0;
  const scrub = (node) => {
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const v = node[i];
        if (v && typeof v === 'object' && v.type === 'testimonial') {
          node.splice(i, 1);
          n++;
        } else scrub(v);
      }
      return;
    }
    if (node && typeof node === 'object') for (const k of Object.keys(node)) scrub(node[k]);
  };
  scrub(data);
  return n;
}
function normalize(data) {
  let n = 0;
  walkStrings(data, (s0) => {
    let a = s0;
    for (const [rx, rep] of HONEST) {
      rx.lastIndex = 0;
      a = a.replace(rx, rep);
    }
    if (a === s0) return s0;
    // ⚠️ TRIM ONLY WHEN A RULE FIRED. Applying .trim() to every string rewrote hundreds that had
    // no promise in them — including HTML fragments like ", and " that concatenate around links,
    // where losing the trailing space renders "towing, andlockout services". A cleanup that
    // silently reformats copy it was not asked to touch is not a cleanup.
    n++;
    return a.replace(/\s{2,}/g, ' ').trim();
  });
  return n;
}

const hosts = fs
  .readFileSync('/tmp/older_hosts.txt', 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
const slugs = hosts
  .map((h) => h.replace(/^www\./, '').replace(/\.[a-z]+$/, ''))
  .filter((s) => !ONLY || s === ONLY);
const tpls = await rest(
  `templates?select=id,slug,rev,published,custom_domain,data&slug=in.(${slugs.join(',')})`
);

console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${tpls.length} templates\n`);
const tot = { t: 0, p: 0, done: 0, fail: 0 };
for (const tpl of tpls) {
  const data = structuredClone(tpl.data);
  const t = stripTestimonials(data);
  const p = normalize(data);
  // ⚠️ A CLEAN `templates.data` DOES NOT MEAN A CLEAN PAGE — do not skip here. The renderer serves
  // a published snapshot, and for any site with a legacy `sites` row that snapshot is a SEPARATE
  // copy that this script also has to rewrite. On a re-run after a partial failure, data is clean
  // and the live page is not; skipping would report success over a still-dirty page. That is
  // precisely what happened to graftontowing, twice — once here and once in strip-hero-image.mjs.
  const alreadyClean = !t && !p;
  if (alreadyClean && !APPLY) {
    console.log(`  ·  ${tpl.slug} — already clean`);
    continue;
  }
  if (alreadyClean && !tpl.published) {
    console.log(`  ·  ${tpl.slug} — already clean`);
    continue;
  }
  tot.t += t;
  tot.p += p;
  console.log(
    alreadyClean
      ? `  ·  ${tpl.slug} — data clean; re-syncing the published snapshot`
      : `  ✂  ${tpl.slug} — ${APPLY ? '' : 'would '}fix ${t} testimonial block(s), ${p} string(s)`
  );
  if (!APPLY) continue;
  try {
    if (!alreadyClean)
      await rest('rpc/commit_template_http', {
        method: 'POST',
        body: JSON.stringify({
          p_payload: {
            id: tpl.id,
            base_rev: tpl.rev ?? 0,
            patch: { data },
            actor: null,
            kind: 'save',
            org_id: null,
          },
        }),
      });
    if (tpl.published) {
      await rest('rpc/publish_template_demo', {
        method: 'POST',
        body: JSON.stringify({ p_template_id: tpl.id }),
      });
      // ⚠️ Legacy `sites` rows shadow the republish — see scripts/strip-hero-image.mjs for the full
      // account. Without this the page never changes.
      const [legacy] = await rest(
        `sites?select=id,published_snapshot_id&slug=eq.${encodeURIComponent(tpl.slug)}`
      );
      if (legacy?.published_snapshot_id) {
        const [pinned] = await rest(`snapshots?select=*&id=eq.${legacy.published_snapshot_id}`);
        if (pinned) {
          const clean = structuredClone(pinned);
          stripTestimonials(clean);
          normalize(clean);
          clean.id = crypto.randomUUID();
          clean.created_at = new Date().toISOString();
          // ⚠️ `snapshots_template_rev_unique` is (template_id, rev), and reusing the template's
          // current rev collides with any snapshot already minted at it — which is exactly what
          // happened on graftontowing, where the hero fix had already taken rev 123. Ask the table
          // for its high-water mark instead of guessing.
          const [top] = await rest(
            `snapshots?select=rev&template_id=eq.${tpl.id}&order=rev.desc&limit=1`
          );
          clean.rev = Math.max(tpl.rev ?? 0, top?.rev ?? 0) + 1;
          clean.commit_message = 'strip invented promises + fabricated testimonials';
          await rest('snapshots', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(clean),
          });
          await rest(`sites?id=eq.${legacy.id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ published_snapshot_id: clean.id }),
          });
          console.log(`     legacy snapshot rewritten → ${clean.id.slice(0, 8)}…`);
        }
      }
    }
    tot.done++;
  } catch (e) {
    tot.fail++;
    console.log(`  ✗  ${tpl.slug} — ${e.message}`);
  }
}
console.log(
  `\n  testimonials: ${tot.t} · strings: ${tot.p} · committed: ${tot.done} · failed: ${tot.fail}`
);
if (!APPLY) {
  console.log('\n  Dry run. Re-run with --apply to write.');
  process.exit(0);
}

console.log('\nVerifying live…');
await new Promise((r) => setTimeout(r, 6000));
let clean = 0;
for (const host of hosts.filter((h) => !ONLY || h.includes(ONLY))) {
  try {
    const res = await fetch(`https://${host}`, { redirect: 'follow' });
    const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, '');
    const text = html.replace(/<[^>]+>/g, ' ');
    const hits = RESIDUAL.filter((rx) => rx.test(text)).map((rx) => String(rx));
    if (res.status === 200 && !hits.length) {
      clean++;
      console.log(`  ✓ ${host}`);
    } else
      console.log(`  ✗ ${host} — HTTP ${res.status}${hits.length ? ' · ' + hits.join(', ') : ''}`);
  } catch (e) {
    console.log(`  ✗ ${host} — ${e.message}`);
  }
}
console.log(`\n  clean live pages: ${clean}/${hosts.length}`);
