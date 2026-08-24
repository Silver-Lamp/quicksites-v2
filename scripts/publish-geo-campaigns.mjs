#!/usr/bin/env node
// scripts/publish-geo-campaigns.mjs
//
// Take the geo-domain pitch sites live: strip fabricated testimonials, publish, verify.
//
//   node scripts/publish-geo-campaigns.mjs                 # dry run (default)
//   node scripts/publish-geo-campaigns.mjs --apply
//   node scripts/publish-geo-campaigns.mjs --apply --only olympia-towing.com
//
// ⚠️ USES PLAIN fetch AGAINST PostgREST, NOT supabase-js — deliberately. supabase-js builds a
// realtime client in its constructor, which throws on Node < 22 ("no native WebSocket") before a
// single query runs. The first cut of this script carried a "requires Node 22" comment instead,
// and the very first person to run it got a stack trace. A comment is not a dependency check;
// removing the dependency is. This needs only Node 18+ (global fetch).
//
// ⚠️ WHY THE TESTIMONIAL STRIP IS NOT OPTIONAL, AND WHY THE SCRIPT REFUSES RATHER THAN WARNS.
// 13 of these 29 pitch sites carry invented 5-star reviews — seven quotes recycled across sites
// with the business name swapped in ("Called in a panic and they had someone out fast." —
// "Relieved Customer"). None of these businesses has ever served a customer: they are pitch sites
// for domains we intend to RENT to a real plumber or tow operator, who would then inherit
// fabricated reviews about their own business on an indexed page. That is the invented-menu
// failure with a licensed trade attached, and indexing makes it hard to walk back.
//
// So `publishOne` refuses any template that still has a testimonial block. A warning would be a
// thing someone skips at 1am on the twenty-ninth site; a refusal is not.
//
// ⚠️ NO custom_domain WRITE. Middleware resolves an arbitrary custom domain by its apex label
// (`boston-plumbing.com` → /sites/boston-plumbing), and all 29 slugs already equal their apex —
// verified before this script was written. Setting custom_domain would be a second source of
// truth for something the router already derives.

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
if (!BASE || !KEY)
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key in .env.local');
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
  if (!res.ok) throw new Error(body?.message || `${res.status} ${text.slice(0, 160)}`);
  return body;
}
const select = (path) => rest(path);
const patch = (path, payload) =>
  rest(path, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
/**
 * Sanctioned publish: public.publish_template_demo(uuid).
 *
 * ⚠️ THE NAME IS A MISNOMER AND COST TWO FAILED ATTEMPTS TO GET PAST. It is the generic publish
 * helper — it mints a fresh `template_versions` snapshot, upserts `published_sites`, sets
 * `app.bypass_template_guard` and flips `templates.published`. Nothing about it is demo-specific;
 * it stamps no demo flag. CLAUDE.md lists it among the sanctioned RPCs for exactly this reason.
 *
 * ⚠️ What did NOT work, so nobody re-walks it:
 *   • a direct PATCH of `published` — the guard rejects it ("Use app.commit_template()"), even
 *     though app/api/templates/[id]/publish/route.ts performs precisely that write;
 *   • `app.publish_site` / `public.publish_site` — present in the schema but BROKEN: they
 *     reference `app.snapshots`, a relation that does not exist. A callable RPC that throws on
 *     a missing table is worse than an absent one, because its presence reads as the intended path.
 *
 * ⚠️ `published_sites.domain` ends up as `<slug>.quicksites.ai` because these templates have no
 * `custom_domain` set. That is cosmetic here: the renderer resolves template → template_versions
 * → published_sites BY SNAPSHOT ID, never by domain, and middleware maps the real domain to the
 * slug. Verified in app/sites/[slug]/[[...rest]]/page.tsx before relying on it.
 */
async function publishRpc(templateId) {
  return rest('rpc/publish_template_demo', {
    method: 'POST',
    body: JSON.stringify({ p_template_id: templateId }),
  });
}

/** Sanctioned template write. Tries public.commit_template_http, then app.commit_template. */
async function commitTemplate(payload) {
  try {
    return await rest('rpc/commit_template_http', {
      method: 'POST',
      body: JSON.stringify({ p_payload: payload }),
    });
  } catch (e) {
    return await rest('rpc/commit_template', {
      method: 'POST',
      headers: { 'Content-Profile': 'app' },
      body: JSON.stringify({ p_payload: payload }),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Promise copy → the honest variant that ALREADY EXISTS in the scaffold.
//
// ⚠️ NOTHING HERE IS INVENTED. Enumerating the FAQ answers across all 29 templates showed the
// scaffold ships BOTH a promise version and a hedged version of every answer, assigned at random
// roughly 50/50. So this is not rewriting copy — it is normalising to the variant the same
// scaffold already produces. Left column counts were 8/9/6/6/6; right column 7/7/8/5/4.
//
// ⚠️ WHY THIS MATTERS MORE THAN IT LOOKS: these pages get RENTED to a real plumber or tow
// operator, who then owns every claim on them. "Fully licensed and insured" is a regulated claim
// about a business that does not exist yet, and "we respond within the hour" is a service promise
// nobody has agreed to keep. Six of the 29 asserted licensure outright.
//
// ⚠️ I MISSED THIS TWICE by checking one template (boston-plumbing, which happens to ship the
// hedged variants) and generalising to all 29. Seventeen were affected. Hence the map is built
// from an enumeration of every template, not a sample — and the refusal below is what makes that
// stick when the next person adds a template.
const HONEST = [
  [/In most cases we respond within the hour\.\s*/g, ''],
  [
    /Reach out through the contact form or give us a call [—-] we[\u2019']ll get back to you quickly with a free, no-obligation quote\./g,
    'Send a message through the contact form or give us a call, and we\u2019ll get back to you.',
  ],
  [
    /We provide a clear estimate before any work begins and accept all major payment methods\./g,
    'Ask about pricing and payment when you get in touch and we\u2019ll walk you through it.',
  ],
  [
    /Yes\s*[—-]\s*.{0,60}? is fully licensed and insured, so you[\u2019']re covered every step of the way\./g,
    'Ask us and we\u2019ll confirm our current license and insurance details before any work starts.',
  ],
  [
    /Yes\s*[—-]\s*we prioritize urgent jobs and get to you the same day whenever possible\./g,
    'Call us and we\u2019ll tell you what we can do today.',
  ],
];

/**
 * ⚠️ EVERYTHING BELOW WALKS THE WHOLE `data` TREE INSTEAD OF ONE ARRAY, AND THAT IS THE POINT.
 *
 * A page carries the same content in THREE parallel places:
 *     .pages[].content_blocks[].content.items[].answer
 *     .pages[].blocks[].content.items[].answer
 *     .pages[].blocks[].props.items[].answer
 *
 * The first cut of this script edited only `content_blocks` and reported success while 15 of 29
 * templates still carried the promise copy — the rewrite landed in a copy the renderer may not
 * read. This repo has already shipped that exact bug once: HEAD of main is
 * `fix(resume): the repoint script wrote one of the page's two block arrays`.
 *
 * So: no path-specific edits. Walk the tree, transform every string, drop every testimonial block
 * wherever it lives. A structural sweep cannot be defeated by a fourth copy appearing later.
 */
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

/** Remove testimonial blocks from EVERY block array on every page. */
function stripTestimonialBlocks(data) {
  let removed = 0;
  const scrub = (node) => {
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const v = node[i];
        if (v && typeof v === 'object' && v.type === 'testimonial') {
          node.splice(i, 1);
          removed++;
        } else scrub(v);
      }
      return;
    }
    if (node && typeof node === 'object') for (const k of Object.keys(node)) scrub(node[k]);
  };
  scrub(data);
  return removed;
}

/** True if a testimonial block survives anywhere in the tree. */
function hasTestimonial(t) {
  return /"type"\s*:\s*"testimonial"/.test(JSON.stringify(t?.data ?? {}));
}

/** True if any promise-shaped copy survives anywhere in the tree. */
function hasPromise(t) {
  const blob = JSON.stringify(t?.data ?? {});
  return HONEST.some(([rx]) => {
    rx.lastIndex = 0;
    return rx.test(blob);
  });
}

/** Normalise promise copy everywhere it appears. Returns how many strings changed. */
function normalizeCopy(data) {
  let n = 0;
  walkStrings(data, (s0) => {
    let a = s0;
    for (const [rx, rep] of HONEST) {
      rx.lastIndex = 0;
      a = a.replace(rx, rep);
    }
    if (a !== s0) {
      n++;
      return a.replace(/\s{2,}/g, ' ').trim();
    }
    return s0;
  });
  return n;
}

/** Remove the testimonial block through the sanctioned RPC — direct UPDATEs to `data` are
 *  trigger-blocked (CLAUDE.md §8). */
async function cleanTemplate(t) {
  const data = structuredClone(t.data);
  const removed = stripTestimonialBlocks(data);
  const reworded = normalizeCopy(data);
  if (!removed && !reworded) return { removed: 0, reworded: 0 };
  if (!APPLY) return { removed, reworded };

  await commitTemplate({
    id: t.id,
    base_rev: t.rev ?? 0,
    patch: { data },
    actor: null,
    kind: 'save',
    org_id: null,
  });
  return { removed, reworded };
}

async function publishOne(t, strippedThisPass) {
  // ⚠️ Re-read rather than trusting the in-memory copy: if the strip failed, this is the last
  // thing standing between a fabricated review and a live indexed page.
  //
  // ⚠️ In a DRY RUN nothing was committed, so a re-read still shows the block we would have
  // removed. Reporting that as a refusal would make the dry run predict 13 failures that --apply
  // would sail through — and a dry run that cries wolf is one people stop reading, which is the
  // same silence-looks-like-success failure the refusal exists to prevent.
  if (!APPLY) return strippedThisPass ? 'would clean, then publish' : 'would publish';
  const [fresh] = await select(`templates?select=id,slug,published,data&id=eq.${t.id}`);
  if (!fresh) throw new Error('template vanished');
  if (hasTestimonial(fresh)) throw new Error('REFUSED: still has a testimonial block');
  // ⚠️ Same reasoning as the testimonial refusal: a warning is a thing someone skips on the
  // twenty-ninth site. A regulated claim about a business that does not exist must not be able
  // to reach a live page through this script.
  if (hasPromise(fresh)) throw new Error('REFUSED: still has invented promise copy');
  // See publishRpc for why this is publish_template_demo and not the two more obvious paths.
  await publishRpc(t.id);
  return 'published';
}

// ⚠️ THE TARGET LIST IS DERIVED, NEVER READ FROM A SCRATCH FILE. The first cut read
// /tmp/live32.txt — a file produced by hand during one session, which would crash on a fresh
// machine or after a reboot, and (worse) could silently go stale and publish the wrong set.
// A script that cannot rebuild its own inputs is not runnable twice.
const all = await select(
  'geo_industry_campaigns?select=domain,template_id&domain=not.is.null&template_id=not.is.null&limit=500'
);
const candidates = (all ?? []).filter(
  (c) => !c.domain.endsWith('.example') && (!ONLY || c.domain === ONLY)
);

// Only touch domains whose DNS actually resolves — publishing a template behind an unpointed
// domain is harmless but reports a confusing failure at the verify step. `--all` overrides.
const dns = await import('node:dns/promises');
const camps = [];
for (const c of candidates) {
  if (args.includes('--all')) {
    camps.push(c);
    continue;
  }
  try {
    await dns.resolve4(c.domain);
    camps.push(c);
  } catch {
    /* not pointed yet — skip silently, counted below */
  }
}
const skipped = candidates.length - camps.length;
if (skipped)
  console.log(`  (skipping ${skipped} campaign domain(s) with no DNS — pass --all to include)\n`);
const ids = (camps ?? []).map((c) => c.template_id).filter(Boolean);
const tpls = ids.length
  ? await select(`templates?select=id,slug,rev,published,data&id=in.(${ids.join(',')})`)
  : [];
const byId = Object.fromEntries((tpls ?? []).map((t) => [t.id, t]));

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${camps?.length ?? 0} campaigns\n`);
let stripped = 0,
  dePromised = 0,
  published = 0,
  failed = 0;
for (const c of camps ?? []) {
  const t = byId[c.template_id];
  if (!t) {
    console.log(`  ?  ${c.domain} — no template`);
    continue;
  }
  try {
    const { removed, reworded } = await cleanTemplate(t);
    if (removed || reworded) {
      stripped += removed ? 1 : 0;
      dePromised += reworded ? 1 : 0;
      const bits = [
        removed ? `${removed} testimonial block(s)` : null,
        reworded ? `${reworded} promise(s)` : null,
      ].filter(Boolean);
      console.log(`  ✂  ${c.domain} — ${APPLY ? 'fixed' : 'would fix'} ${bits.join(' + ')}`);
    }
    const r = await publishOne(t, removed > 0 || reworded > 0);
    published++;
    console.log(`  ✓  ${c.domain} — ${r}`);
  } catch (e) {
    failed++;
    console.log(`  ✗  ${c.domain} — ${e.message}`);
  }
}
console.log(
  `\n  testimonials removed: ${stripped} · promises reworded: ${dePromised} · published: ${published} · failed: ${failed}`
);
if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.');
  process.exit(0);
}

console.log('\nVerifying live…');
let ok = 0;
for (const c of camps ?? []) {
  try {
    const res = await fetch(`https://${c.domain}`, { redirect: 'follow' });
    const good = res.status === 200;
    if (good) ok++;
    console.log(`  ${good ? '✓' : '✗'} ${c.domain} — HTTP ${res.status}`);
  } catch (e) {
    console.log(`  ✗ ${c.domain} — ${e.message}`);
  }
}
console.log(`\n  serving 200: ${ok}/${camps?.length ?? 0}`);
console.log('⚠️ Vercel/CDN may need a minute; re-run the verify if a few lag.');
