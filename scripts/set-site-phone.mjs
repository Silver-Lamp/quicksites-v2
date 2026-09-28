// scripts/set-site-phone.mjs
//
// Put a campaign's tracking number onto its pitch site, everywhere the old one lived, and push
// it live.
//
//   node scripts/set-site-phone.mjs --domain southhilltowing.com [--number +1253...] [--apply]
//
// ⚠️ THE STEP THAT MAKES A PURCHASE MEAN ANYTHING, and it is easy to skip because everything
// else reports success. Buying a tracking number wires Twilio, saves the forward-to and texts
// the business — and changes nothing a visitor sees. southhilltowing.com was still advertising
// (360) 458-2555 after +1 253 655 2016 was bought for it. Every call the site produced would
// have gone somewhere untracked, the campaign would have read "0 calls", and the market would
// have looked dead. Worse, the business had already been texted that calls were coming.
//
// ⚠️ SAME MULTI-COPY TREE as the release script (CLAUDE.md §8): `meta.contact.phone`,
// `identity.contact.phone`, `meta.identity.contact.phone`, and `cta_phone` under BOTH `blocks[]`
// and `content_blocks[]`, in both `props` and `content` — plus `templates.phone`, a column the
// hero falls back to. A path-specific edit changes one copy and reports success.
//
// ⚠️ It REPLACES the phone that is there; it does not add one. If the site shows a real
// business's number, that number stops being advertised — which is the point when the site is an
// unrented pitch site, and is NOT something to run against a claimed site without asking.
//
// Defaults `--number` to the campaign's own `tracking_number`. Dry by default; pass --apply.
import ws from 'ws';
globalThis.WebSocket ??= ws;
import { loadEnv, makeRest, republishTemplate } from './lib/republishTemplate.mjs';

const args = process.argv.slice(2);
const arg = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : null;
};
const APPLY = args.includes('--apply');
/**
 * Also rewrite phone numbers that appear in PROSE (rich-text `html` / tiptap `text`).
 *
 * ⚠️ OFF BY DEFAULT, AND THAT IS DELIBERATE. The field-name rule exists because a number-shaped
 * string in copy ("serving 253 homes") is not a contact field. But baked-in prose is a real
 * problem: southhilltowing.com told visitors "Contact us at 262-302-8118" on three pages — a
 * WISCONSIN number on a South Hill page, in both the html and the tiptap json — while the
 * contact block showed the right one. Anyone reading the paragraph rang a stranger.
 *
 * So it is opt-in, it only ever replaces a number that is NOT already this site's, and the dry
 * run prints every string it would touch. Visible and reviewed beats clever.
 */
const PROSE = args.includes('--prose');
const DOMAIN = arg('domain');
if (!DOMAIN) {
  console.error('Usage: --domain <host> [--number +1XXXXXXXXXX] [--apply]');
  process.exit(1);
}

const env = loadEnv();
const rest = makeRest(env);

const [campaign] = await rest(
  `geo_industry_campaigns?select=id,domain,template_id,tracking_number,forward_to&domain=eq.${DOMAIN}`,
);
const wanted = (arg('number') || campaign?.tracking_number || '').trim();
const digits = wanted.replace(/\D/g, '').replace(/^1/, '');
if (digits.length !== 10) {
  console.error(
    `No usable number. Pass --number, or give the campaign a tracking_number first (got "${wanted}").`,
  );
  process.exit(1);
}
const E164 = `+1${digits}`;
const DISPLAY = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;

const [tpl] = await rest(
  `templates?select=id,slug,rev,phone,data,published,custom_domain&or=(custom_domain.eq.${DOMAIN},slug.eq.${DOMAIN.split('.')[0]})&limit=1`,
);
if (!tpl) throw new Error(`No template for ${DOMAIN}`);

const PHONE_KEYS = new Set(['phone', 'cta_phone', 'telephone', 'phone_number']);
/** Rich-text carriers. Both are rewritten or the editor and the page disagree. */
const PROSE_KEYS = new Set(['html', 'text']);
/** A phone inside a sentence — punctuated forms only, so a bare 10-digit id is not a target. */
const PROSE_PHONE = /\(?\d{3}\)?[ .-]{1,2}\d{3}[ .-]{1,2}\d{4}/g;
/** Anything that looks like a US phone, so the OLD number is found whatever its formatting. */
const PHONEISH = /^\+?1?[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}$/;

/** Walk every string; rewrite the phone FIELDS only. Returns what changed. */
function sweep(root, write) {
  const hits = [];
  (function walk(node, path, parent, key) {
    const isPhoneKey = key !== null && PHONE_KEYS.has(String(key));
    // ⚠️ A null/empty phone field is the COMMON case on a pitch site that never had a phone,
    // and the first version never even visited it (it only handled strings). Four campaigns
    // bought a number and rendered nothing because `meta.contact.phone` was null.
    if (isPhoneKey && (node === null || node === undefined || node === '')) {
      hits.push([path, String(node), E164]);
      if (write && parent) parent[key] = E164;
      return;
    }
    if (typeof node === 'string') {
      // ⚠️ Keyed on the FIELD NAME, not on "does this look like a phone". A number-shaped string
      // in prose ("serving 253 homes") is not a contact field, and rewriting it would edit copy.
      if (!isPhoneKey) return;
      if (!node.trim()) return;
      if (!PHONEISH.test(node.trim())) return;
      const next = node.includes('(') || node.includes('-') ? DISPLAY : E164;
      if (next === node) return;
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

/** Replace foreign phone numbers inside rich text. Only when --prose. */
function sweepProse(root, write) {
  const hits = [];
  (function walk(node, path, parent, key) {
    if (typeof node === 'string') {
      if (!PROSE_KEYS.has(String(key))) return;
      PROSE_PHONE.lastIndex = 0;
      const found = node.match(PROSE_PHONE);
      if (!found) return;
      // Leave anything that is already this site's number, however punctuated.
      const foreign = found.filter((f) => f.replace(/\D/g, '').replace(/^1/, '') !== digits);
      if (!foreign.length) return;
      const next = node.replace(PROSE_PHONE, (m) =>
        m.replace(/\D/g, '').replace(/^1/, '') === digits ? m : DISPLAY,
      );
      hits.push([path, [...new Set(foreign)].join(', '), node.length > 90 ? node.slice(0, 90) + '…' : node]);
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

console.log(`${DOMAIN} → ${E164}`);
console.log(`template ${tpl.id} published=${tpl.published} phone_column=${tpl.phone ?? '(null)'}`);
if (campaign?.forward_to) console.log(`forwards to ${campaign.forward_to}`);

const preview = sweep(structuredClone(tpl.data), false);
console.log(`\n${preview.length} phone field(s) to rewrite:`);
for (const [p, from, to] of preview) console.log(`  ${p}\n    "${from}" -> "${to}"`);

const prosePreview = PROSE ? sweepProse(structuredClone(tpl.data), false) : [];
if (PROSE) {
  console.log(`\n${prosePreview.length} prose string(s) carry a DIFFERENT number:`);
  for (const [p, found, v] of prosePreview) console.log(`  ${p}\n    replacing ${found}\n    "${v}"`);
} else {
  const scan = sweepProse(structuredClone(tpl.data), false);
  if (scan.length) {
    console.log(
      `\n⚠️ ${scan.length} prose string(s) mention a different phone number ` +
        `(${[...new Set(scan.map((h) => h[1]))].join(', ')}). Re-run with --prose to rewrite them.`,
    );
  }
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.');
  process.exit(0);
}

const nextData = structuredClone(tpl.data);
sweep(nextData, true);
// The path contact-form.tsx reads from a published SNAPSHOT (the column is not in the snapshot).
nextData.meta = nextData.meta ?? {};
nextData.meta.contact = nextData.meta.contact ?? {};
if ((nextData.meta.contact.phone ?? '').toString().replace(/\D/g, '').replace(/^1/, '') !== digits) {
  nextData.meta.contact.phone = E164;
  console.log('  ensured $.meta.contact.phone');
}
if (PROSE) sweepProse(nextData, true);

const { repointed } = await republishTemplate(
  rest,
  tpl,
  nextData,
  (snap) => {
    if (snap?.data) {
      sweep(snap.data, true);
      if (PROSE) sweepProse(snap.data, true);
    }
  },
  `set site phone to tracking number ${E164}`,
  { publish: tpl.published === true },
);

// The column the hero falls back to. commit_template CAN set a value (it is only CLEARING it
// that the coalesce/NULLIF pattern makes impossible — see 20260859).
await rest('rpc/commit_template_http', {
  method: 'POST',
  body: JSON.stringify({
    p_payload: { id: tpl.id, base_rev: (tpl.rev ?? 0) + 1, patch: { phone: digits }, actor: null, kind: 'save', org_id: null },
  }),
});
const [after] = await rest(`templates?select=phone&id=eq.${tpl.id}`);
console.log(
  `templates.phone now ${after?.phone ?? '(null)'}${
    (after?.phone ?? '').replace(/\D/g, '').replace(/^1/, '') === digits ? ' ✓' : ' ⚠️ NOT SET'
  }`,
);

console.log(`done. repointed_snapshot=${repointed ?? 'n/a'}`);
console.log('⚠️ Verify the LIVE page — the renderer serves the snapshot, not the row.');
