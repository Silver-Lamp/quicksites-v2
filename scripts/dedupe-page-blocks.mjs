#!/usr/bin/env node
// scripts/dedupe-page-blocks.mjs
//
// One FAQ per page, one contact form per page. Merges or drops the duplicates, commits through
// the sanctioned RPC, republishes, and verifies against the LIVE page.
//
//   node scripts/dedupe-page-blocks.mjs                    # dry run (default)
//   node scripts/dedupe-page-blocks.mjs --apply
//   node scripts/dedupe-page-blocks.mjs --apply --only graftontowing
//
// Found because graftontowing.com — which holds POSITION 1 for its city+trade query — rendered
// "Frequently Asked Questions" twice. Two blocks, different questions, both post-scrub. So this
// is not a rendering bug and not a copy-paste of one block: the page genuinely carried two FAQ
// sets, and a visitor read the same site answering itself twice.
//
// ⚠️ A REPEATED BLOCK TYPE IS NOT AUTOMATICALLY A BUG, WHICH IS WHY THE LIST IS EXPLICIT.
// Two `text` blocks is ordinary prose and `auburnroofcleaning` has exactly that — sweeping "any
// duplicated type" would have edited a page that was fine. Only types that are structurally
// singular on a page are handled: a page has one FAQ and one contact form, or it is confusing.
//
// ⚠️ MERGE, NEVER DELETE, FOR FAQ. The two Grafton sets overlapped on three answers and each had
// questions the other lacked. Dropping either silently loses content that someone wrote.
// Contact forms are different: a second one is pure duplication, so the first survives.
//
// ⚠️ WRITES BOTH `blocks` AND `content_blocks`. The same content lives in up to three places
// (CLAUDE.md §8). A path-specific edit updates one copy, reports success, and leaves the renderer
// possibly reading another — the failure that made a previous sweep report "16 reworded" while 15
// templates still carried the old copy.
//
// ⚠️ VERIFIES THE LIVE PAGE, NOT THE ROW. The renderer serves the published snapshot, so a
// committed fix that was never published looks identical to no fix at all from the editor.
import fs from 'node:fs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

/** Types that may appear at most once on a page. `text` is deliberately absent. */
const SINGULAR = new Set(['faq', 'contact_form']);

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!BASE || !KEY) throw new Error('Missing Supabase URL or service-role key in .env.local');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(body?.message || `${res.status} ${text.slice(0, 160)}`);
  return body;
}

async function commitTemplate(payload) {
  try {
    return await rest('rpc/commit_template_http', { method: 'POST', body: JSON.stringify({ p_payload: payload }) });
  } catch {
    return await rest('rpc/commit_template', {
      method: 'POST', headers: { 'Content-Profile': 'app' }, body: JSON.stringify({ p_payload: payload }),
    });
  }
}
const publishRpc = (id) =>
  rest('rpc/publish_template_demo', { method: 'POST', body: JSON.stringify({ p_template_id: id }) });

/** Where a block keeps its payload varies by vintage: `props` on newer blocks, `content` on older. */
const payloadOf = (b) => (b?.props && Object.keys(b.props).length ? b.props : b?.content) || {};
const itemsOf = (b) => {
  const p = payloadOf(b);
  return Array.isArray(p.items) ? p.items : [];
};
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Token overlap, for REPORTING near-duplicates the merge kept.
 *
 * ⚠️ Deliberately reports rather than deletes. Exact-answer dedupe is mechanical and safe;
 * deciding that "How quickly can you respond?" and "How quickly can you arrive?" are the same
 * question is an editorial call on a live page that ranks #1, and a script should not make it
 * quietly. The pairs are printed so a person can trim them.
 */
function similarity(a, b) {
  const A = new Set(norm(a).split(' ').filter((w) => w.length > 3));
  const B = new Set(norm(b).split(' ').filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / new Set([...A, ...B]).size;
}

/**
 * Merge FAQ blocks into the first, keeping every question whose ANSWER is new.
 *
 * Deduping on the answer rather than the question is deliberate: the Grafton sets asked
 * "Do you charge for estimates?" and "What forms of payment do you accept?" and gave the SAME
 * sentence back. Two questions with one answer reads like padding, which is what a duplicated
 * FAQ already looked like.
 */
function mergeFaq(blocks) {
  const [first, ...rest] = blocks;
  const merged = [...itemsOf(first)];
  const seenA = new Set(merged.map((i) => norm(i.answer)));
  const seenQ = new Set(merged.map((i) => norm(i.question)));
  for (const b of rest) {
    for (const it of itemsOf(b)) {
      if (seenA.has(norm(it.answer)) || seenQ.has(norm(it.question))) continue;
      seenA.add(norm(it.answer));
      seenQ.add(norm(it.question));
      merged.push(it);
    }
  }
  const out = structuredClone(first);
  if (out.props && Object.keys(out.props).length) out.props = { ...out.props, items: merged };
  else out.content = { ...(out.content || {}), items: merged };
  return out;
}

/** Returns { blocks, notes } with singular types collapsed, or null if nothing changed. */
function dedupePage(list) {
  const byType = new Map();
  for (const b of list) {
    const t = b?.type;
    if (!SINGULAR.has(t)) continue;
    byType.set(t, [...(byType.get(t) || []), b]);
  }
  const dupes = [...byType.entries()].filter(([, v]) => v.length > 1);
  if (!dupes.length) return null;

  const notes = [];
  const replacement = new Map();
  const dropIds = new Set();
  for (const [type, group] of dupes) {
    if (type === 'faq') {
      const merged = mergeFaq(group);
      const before = group.map((b) => itemsOf(b).length);
      replacement.set(group[0], merged);
      group.slice(1).forEach((b) => dropIds.add(b));
      notes.push(`faq: ${group.length} blocks (${before.join('+')} items) → 1 block (${itemsOf(merged).length} items)`);
      const items = itemsOf(merged);
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
          if (similarity(items[i].answer, items[j].answer) > 0.5)
            notes.push(
              `    ⚠️ kept both, near-duplicate answers — a human should trim one:\n` +
              `       "${items[i].question}"\n       "${items[j].question}"`
            );
    } else {
      group.slice(1).forEach((b) => dropIds.add(b));
      notes.push(`${type}: ${group.length} → 1 (kept the first, dropped ${group.length - 1})`);
    }
  }
  const out = list
    .filter((b) => !dropIds.has(b))
    .map((b) => replacement.get(b) || b);
  return { blocks: out, notes };
}

const main = async () => {
  const rows = await rest(
    'templates?select=id,slug,template_name,custom_domain,published,data,rev&published=eq.true&order=slug'
  );
  const targets = [];

  for (const t of rows) {
    if (ONLY && t.slug !== ONLY && t.custom_domain !== ONLY) continue;
    const pages = t.data?.pages;
    if (!Array.isArray(pages)) continue;

    const data = structuredClone(t.data);
    const notes = [];
    let changed = false;

    data.pages = pages.map((p, i) => {
      const page = structuredClone(p);
      // Both arrays, always — they are copies of the same content and drift silently.
      for (const key of ['blocks', 'content_blocks']) {
        const list = Array.isArray(page[key]) ? page[key] : null;
        if (!list) continue;
        const res = dedupePage(list);
        if (!res) continue;
        page[key] = res.blocks;
        changed = true;
        for (const n of res.notes) notes.push(`page ${i} (${p.slug || '?'}) ${key} — ${n}`);
      }
      return page;
    });

    if (changed) targets.push({ t, data, notes });
  }

  if (!targets.length) {
    console.log('Nothing to fix: no published template has a duplicated singular block.');
    return;
  }

  for (const { t, data, notes } of targets) {
    const label = t.custom_domain || `${t.slug} (no domain)`;
    console.log(`\n${APPLY ? '→' : '·'} ${label}`);
    notes.forEach((n) => console.log(`    ${n}`));
    if (!APPLY) continue;

    const err = await commitTemplate({
      id: t.id, base_rev: t.rev ?? 0, patch: { data }, actor: null, kind: 'save', org_id: null,
    });
    if (err?.error) throw new Error(`commit failed for ${label}: ${err.error}`);
    await publishRpc(t.id);
    console.log('    committed + republished');

    if (t.custom_domain) {
      // The row is not the site. Only the served HTML settles it.
      const url = `https://${t.custom_domain.replace(/^www\./, 'www.')}/`;
      try {
        const html = await (await fetch(url, { redirect: 'follow' })).text();
        const faqs = (html.match(/Frequently Asked Questions/g) || []).length;
        console.log(`    live check ${url} — "Frequently Asked Questions" ×${faqs}`);
      } catch (e) {
        console.log(`    live check failed: ${e.message}`);
      }
    }
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to commit, republish and verify.');
};

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
