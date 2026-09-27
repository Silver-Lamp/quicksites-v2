// scripts/release-tracking-number.mjs
//
// Take one tracking number off one site, everywhere it lives, and push the change live.
//
//   node scripts/release-tracking-number.mjs --domain millcreektowing.com --number 4252702226 [--apply]
//
// ⚠️ WHY A SCRIPT AND NOT AN EDIT. The same number sits in SEVEN strings on one template —
// `meta.contact.phone`, `meta.identity.contact.phone`, `identity.contact.phone`, and
// `cta_phone` under BOTH `blocks[].props`/`blocks[].content` AND
// `content_blocks[].props`/`content_blocks[].content` (CLAUDE.md §8: the same content lives in
// three places). A path-specific edit clears one copy, reports success, and leaves the renderer
// reading another. This walks the whole tree, so a fourth copy appearing later cannot defeat it.
//
// ⚠️ AND THE TREE IS NOT THE ONLY HOME. `templates.phone` is a COLUMN, and the hero falls back to
// it (`resolvedPhoneDigits = cta_phone || dbPhoneDigits`), so clearing `data` alone leaves the
// number rendering from a source the audit never looked at. Both are cleared here.
//
// ⚠️ The CTA degrades correctly once the digits are gone: `action==='call_phone'` with no digits
// yields `href = undefined`, and `canShowCTA` requires an href — so the button disappears rather
// than becoming a dead "Call" link. Verified by reading `render-blocks/hero.tsx` before running.
//
// Why you would run this: one Twilio number backing two sites makes every call it receives
// unattributable to the site that earned it, and under pay-per-call it bills the wrong market.
// `geo_campaigns_tracking_number_uniq` (20260856) now prevents it at the CAMPAIGN level, but it
// cannot reach a number typed into site CONTENT — which is how +1 425 270 2226 came to be live on
// both maplevalley-towing.com and millcreektowing.com with 13 calls logged and not one of them
// creditable to a site.
//
// Dry by default. Pass --apply to write.
import ws from 'ws';
globalThis.WebSocket ??= ws;
import { loadEnv, makeRest, republishTemplate } from './lib/republishTemplate.mjs';

const args = process.argv.slice(2);
const arg = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : null;
};
const APPLY = args.includes('--apply');
/** SECURITY DEFINER helper that can blank the column the commit RPC structurally cannot. */
const CLEAR_PHONE_FN = 'clear_template_phone';
const DOMAIN = arg('domain');
const NUMBER = (arg('number') || '').replace(/\D/g, '');

if (!DOMAIN || NUMBER.length !== 10) {
  console.error('Usage: --domain <host> --number <10 digits> [--apply]');
  process.exit(1);
}

/** Matches the number however it is punctuated: 4252702226, (425) 270-2226, +14252702226. */
const [a, b, c] = [NUMBER.slice(0, 3), NUMBER.slice(3, 6), NUMBER.slice(6)];
const RE = new RegExp(`\\+?1?[^0-9A-Za-z]{0,2}\\(?${a}\\)?[^0-9A-Za-z]{0,3}${b}[^0-9A-Za-z]{0,3}${c}`, 'g');

/** Walk every string in the tree; return the paths touched. Mutates when `write` is true. */
function sweep(root, write) {
  const hits = [];
  (function walk(node, path, parent, key) {
    if (typeof node === 'string') {
      RE.lastIndex = 0;
      if (!RE.test(node)) return;
      RE.lastIndex = 0;
      // ⚠️ Blank the FIELD when the number is the whole value (a phone field), but only strip the
      // number out of a sentence — replacing prose wholesale would delete copy that happens to
      // mention it.
      const stripped = node.replace(RE, '').trim();
      const next = stripped === '' ? '' : stripped;
      hits.push([path, node, next]);
      if (write && parent) parent[key] = next;
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`, node, i));
    if (node && typeof node === 'object') {
      return Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`, node, k));
    }
  })(root, '$', null, null);
  return hits;
}

const env = loadEnv();
const rest = makeRest(env);

const [tpl] = await rest(
  `templates?select=id,slug,rev,phone,data,published,custom_domain&or=(custom_domain.eq.${DOMAIN},slug.eq.${DOMAIN.split('.')[0]})&limit=1`,
);
if (!tpl) throw new Error(`No template for ${DOMAIN}`);

console.log(`template ${tpl.id}  slug=${tpl.slug}  published=${tpl.published}  phone_column=${tpl.phone ?? '(null)'}`);

const preview = sweep(structuredClone(tpl.data), false);
console.log(`\n${preview.length} string(s) in data carry the number:`);
for (const [p, from, to] of preview) console.log(`  ${p}\n    "${from}" -> "${to}"`);

const clearsColumn = (tpl.phone || '').replace(/\D/g, '') === NUMBER;
console.log(`\ntemplates.phone ${clearsColumn ? 'WILL be cleared' : 'does not hold this number — left alone'}`);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.');
  process.exit(0);
}
if (!preview.length && !clearsColumn) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const nextData = structuredClone(tpl.data);
sweep(nextData, true);

// The same rewrite is applied to the legacy snapshot inside republishTemplate, or a custom
// domain keeps serving the old one.
const { repointed } = await republishTemplate(
  rest,
  tpl,
  nextData,
  (snap) => {
    if (snap?.data) sweep(snap.data, true);
  },
  `release tracking number ${NUMBER}`,
  { publish: tpl.published === true },
);

if (clearsColumn) {
  // ⚠️ THE SANCTIONED RPC CANNOT CLEAR A FIELD, AND IT FAILS SILENTLY WHEN YOU ASK IT TO.
  // `commit_template` writes every scalar as
  //     phone = coalesce(NULLIF(v_patch->>'phone',''), t.phone)
  // so `null` AND `''` both collapse to "keep what was there". It is set-or-keep by
  // construction — sensible protection against a partial patch wiping a column, and it means
  // "remove the phone" is simply not expressible through it. The first version of this script
  // called it with `phone: null`, got a 200, and PRINTED "cleared templates.phone" while the
  // number sat in the column untouched. A success message nobody checked.
  //
  // So: the documented one-off bypass (CLAUDE.md §8), inside a transaction — and then a READ,
  // because the whole lesson here is that the write reporting success is not the write working.
  const cleared = await rest(`rpc/${CLEAR_PHONE_FN}`, {
    method: 'POST',
    body: JSON.stringify({ p_template_id: tpl.id }),
  }).catch((e) => ({ error: String(e) }));
  const [after] = await rest(`templates?select=phone&id=eq.${tpl.id}`);
  if ((after?.phone ?? null) === null) {
    console.log('cleared templates.phone (verified by reading it back)');
  } else {
    console.error(
      `⚠️ templates.phone STILL reads ${after?.phone} — not cleared. ` +
        `The RPC ${CLEAR_PHONE_FN} may be missing; clear it by hand inside a txn with ` +
        `set_config('app.bypass_template_guard','on',true).`,
      cleared?.error ?? '',
    );
    process.exitCode = 1;
  }
}

console.log(`done. published=${tpl.published} repointed_snapshot=${repointed ?? 'n/a'}`);
console.log('⚠️ Verify the LIVE page, not the row — the renderer serves the snapshot.');
