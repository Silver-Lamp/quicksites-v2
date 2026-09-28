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
/** Anything that looks like a US phone, so the OLD number is found whatever its formatting. */
const PHONEISH = /^\+?1?[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}$/;

/** Walk every string; rewrite the phone FIELDS only. Returns what changed. */
function sweep(root, write) {
  const hits = [];
  (function walk(node, path, parent, key) {
    if (typeof node === 'string') {
      // ⚠️ Keyed on the FIELD NAME, not on "does this look like a phone". A number-shaped string
      // in prose ("serving 253 homes") is not a contact field, and rewriting it would edit copy.
      if (!PHONE_KEYS.has(String(key))) return;
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

console.log(`${DOMAIN} → ${E164}`);
console.log(`template ${tpl.id} published=${tpl.published} phone_column=${tpl.phone ?? '(null)'}`);
if (campaign?.forward_to) console.log(`forwards to ${campaign.forward_to}`);

const preview = sweep(structuredClone(tpl.data), false);
console.log(`\n${preview.length} phone field(s) to rewrite:`);
for (const [p, from, to] of preview) console.log(`  ${p}\n    "${from}" -> "${to}"`);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.');
  process.exit(0);
}

const nextData = structuredClone(tpl.data);
sweep(nextData, true);

const { repointed } = await republishTemplate(
  rest,
  tpl,
  nextData,
  (snap) => {
    if (snap?.data) sweep(snap.data, true);
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
