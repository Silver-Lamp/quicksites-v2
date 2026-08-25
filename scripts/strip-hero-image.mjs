#!/usr/bin/env node
// scripts/strip-hero-image.mjs
//
// Remove the hero image from a published template and republish it.
//
//   node scripts/strip-hero-image.mjs --slug graftontowing            # dry run
//   node scripts/strip-hero-image.mjs --slug graftontowing --apply
//
// Written for a specific failure: graftontowing.com — the best-ranking domain in the portfolio,
// #1 for "grafton towing service" — shipped a photorealistic hero with a GENERATED PERSON and
// "GRAFTON TOWING" painted on the truck door and the man's cap, for a business that does not
// exist. That violates the network no-generated-people standard (lib/images/noPeople.ts, rule 9),
// and it is worse than the usual case because the domain actually ranks: someone in Grafton
// searching for a tow sees a man who does not exist standing beside a truck that does not exist.
//
// ⚠️ A contact sheet of all 15 hero images in the portfolio showed 14 are clean (unbranded trucks,
// no people). This is the exception, not the pattern — do not run this over everything.
//
// ⚠️ STRUCTURAL SWEEP, NOT A PATH EDIT. The same hero lives in up to four places:
//   .pages[].blocks[].props.heroImage · .pages[].blocks[].content.image_url
//   .pages[].content_blocks[].props.heroImage · .pages[].content_blocks[].content.image_url
// On graftontowing those four had already DRIFTED — three pointed at the offending image and the
// fourth at a storage object that 404s. Editing one path would have left the violation live.
//
// ⚠️ Blanks the reference; does not delete the stored object. Removing the reference is reversible
// and sufficient; deleting the file is neither.

import fs from 'node:fs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SLUG = args[args.indexOf('--slug') + 1];
if (!SLUG || SLUG.startsWith('--')) throw new Error('--slug <template-slug> is required');

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
  if (!res.ok) throw new Error(body?.message || `${res.status} ${String(text).slice(0, 160)}`);
  return body;
}

const [tpl] = await rest(
  `templates?select=id,slug,rev,published,custom_domain,data&slug=eq.${encodeURIComponent(SLUG)}`
);
if (!tpl) throw new Error(`No template with slug "${SLUG}"`);

/** Blank every hero-image string anywhere in the tree. Returns the values removed. */
function stripHeroes(node, found = []) {
  if (Array.isArray(node)) {
    node.forEach((v) => stripHeroes(v, found));
    return found;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string' && (k === 'heroImage' || k === 'image_url') && /\/hero\//.test(v)) {
        found.push({ key: k, value: v.slice(-44) });
        node[k] = '';
      } else stripHeroes(v, found);
    }
  }
  return found;
}

const data = structuredClone(tpl.data);
const removed = stripHeroes(data);
console.log(
  `\n  ${tpl.slug}  rev=${tpl.rev}  published=${tpl.published}  ${tpl.custom_domain ?? ''}`
);
console.log(`  hero references found: ${removed.length}`);
for (const r of removed) console.log(`    ${r.key.padEnd(11)} …${r.value}`);
if (!APPLY) {
  console.log(
    removed.length
      ? '\n  Dry run. Re-run with --apply to write.'
      : '\n  Nothing to strip (data is already clean).'
  );
  process.exit(0);
}

// ⚠️ A CLEAN `templates.data` DOES NOT MEAN A CLEAN PAGE, so this does not exit early when there
// is nothing to strip. The renderer serves a published SNAPSHOT, and the first run of this script
// proved the two can disagree: data stripped, page unchanged. Re-running must therefore still
// republish and re-sync the pointers, or the fix looks applied and isn't.
if (removed.length) {
  // Direct UPDATEs to templates are trigger-blocked — go through the sanctioned RPC (CLAUDE.md §8).
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
  console.log('  committed');
} else {
  console.log('  data already clean — republishing to push it live');
}

// ⚠️ Republish, or nothing changes for a visitor: the renderer serves the published SNAPSHOT, not
// templates.data. publish_template_demo mints a fresh snapshot (see 20260731) — publish_site is
// broken and a direct `published` UPDATE is refused by the guard.
await rest('rpc/publish_template_demo', {
  method: 'POST',
  body: JSON.stringify({ p_template_id: tpl.id }),
});
console.log('  republished');

// ⚠️ THE LEGACY `sites` ROW SHADOWS THE REPUBLISH, AND WITHOUT THIS THE PAGE NEVER CHANGES.
// app/sites/[slug]/[[...rest]]/page.tsx resolves the snapshot by trying the legacy `sites` table
// FIRST (loadSiteRowBySlug) and only falls through to templates → published_sites when that misses.
// `publish_template_demo` updates published_sites and never touches `sites`, so for any site with
// a legacy row the republish is a no-op from a visitor's point of view: fresh snapshot minted,
// pointer updated, page unchanged. That is exactly what happened on the first run of this script —
// committed, republished, and the generated person was still on the page.
//
// 5 rows in `sites` carry a published_snapshot_id, so 5 sites are affected. Repointing rather than
// nulling: keeping the two sources in sync is the conservative move, and removing the legacy path
// wholesale is a bigger decision than this script should make.
const [legacy] = await rest(
  `sites?select=id,published_snapshot_id&slug=${'eq.' + encodeURIComponent(tpl.slug)}`
);
if (legacy?.published_snapshot_id) {
  // ⚠️ TWO INCOMPATIBLE PUBLISH PATHS, AND THE LEGACY ONE WINS AT RENDER TIME.
  // The renderer resolves a slug by trying `sites` FIRST and only falls through to
  // templates → published_sites when that misses. `publish_template_demo` writes
  // `template_versions` + `published_sites` and never touches `sites`, so on any site with a
  // legacy row a republish mints a snapshot nobody reads. First run of this script proved it:
  // committed, republished, generated person still on the page.
  //
  // ⚠️ It cannot be fixed by repointing at the new snapshot — `sites_published_snapshot_fk`
  // requires an id in the legacy `snapshots` table, and template_versions ids are not in it.
  // ⚠️ Nor by nulling it: with no snapshot and a non-admin visitor the renderer returns empty
  // (page.tsx ~L396), which would take a #1-ranking page down.
  // So: copy the pinned snapshot, strip it, insert under a NEW id, repoint. Additive, keeps
  // snapshots immutable, and a fresh id also busts the 1-hour unstable_cache keyed on that id.
  const [pinned] = await rest(`snapshots?select=*&id=eq.${legacy.published_snapshot_id}`);
  if (pinned) {
    const clean = structuredClone(pinned);
    const wipe = (node) => {
      if (Array.isArray(node)) return node.forEach(wipe);
      if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) {
          const v = node[k];
          if (typeof v === 'string' && /\/hero\/[a-f0-9-]+\.(png|jpe?g|webp)/i.test(v))
            node[k] = '';
          else wipe(v);
        }
      }
    };
    wipe(clean);
    const newId = crypto.randomUUID();
    clean.id = newId;
    clean.created_at = new Date().toISOString();
    clean.commit_message = 'strip generated-person hero (no-generated-people standard)';
    // ⚠️ `snapshots_template_rev_unique` is on (template_id, rev), so a straight copy collides
    // with the row it was copied from. Use the template's CURRENT rev, which the commit above
    // just advanced past anything already snapshotted.
    clean.rev = tpl.rev ?? (pinned.rev ?? 0) + 1;
    await rest('snapshots', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(clean),
    });
    await rest(`sites?id=eq.${legacy.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ published_snapshot_id: newId }),
    });
    console.log(
      `  legacy snapshot rewritten → ${newId.slice(0, 8)}… (was ${legacy.published_snapshot_id.slice(0, 8)}…)`
    );
  }
}

const host = (tpl.custom_domain || `${tpl.slug}.quicksites.ai`).replace(/^https?:\/\//, '');
await new Promise((r) => setTimeout(r, 4000));
const res = await fetch(`https://${host}`, { redirect: 'follow' });
const html = await res.text();
const still = /\/hero\/[a-f0-9-]+\.(?:png|jpg|jpeg|webp)/.exec(html);
console.log(`\n  https://${host} → HTTP ${res.status}`);
console.log(
  still
    ? `  ⚠️ a hero image is STILL on the page: ${still[0]}`
    : '  ✓ no hero image on the live page'
);
