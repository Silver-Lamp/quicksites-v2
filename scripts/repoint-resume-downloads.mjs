#!/usr/bin/env node
// scripts/repoint-resume-downloads.mjs
//
// Point a published site's `file_downloads` block at the résumé-version route, so the block serves
// whatever version is marked Public in the Verbatim workspace instead of a fixed file in the
// public `resumes` bucket.
//
//   node scripts/repoint-resume-downloads.mjs --slug sandon            # dry run (default)
//   node scripts/repoint-resume-downloads.mjs --slug sandon --apply
//
// ⚠️ REQUIRES NODE 22+ (supabase-js needs native WebSocket; Node 20 throws at client construction).
//
// ⚠️ THE ORDERING TRAP THIS SCRIPT EXISTS TO MAKE IMPOSSIBLE. `/api/resume/<slug>/<fmt>` only
// exists once the code is deployed. Repointing the block before that swaps three working download
// links for three 404s on a live page — and the failure is invisible from here, because the block
// still *looks* right in the editor. So the script PREFLIGHTS the real public URL and refuses to
// write unless it already answers 200 with the right content type. A note saying "deploy first"
// would have been one forgotten step; this is a closed door.

// Standalone CLI: the shared client in lib/ is a Next-runtime module (next/headers,
// server-only) and cannot load under plain node, so this file builds its own.
// eslint-disable-next-line no-restricted-imports
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const APPLY = args.includes('--apply');
const SLUG = arg('slug', 'sandon');
const FORMATS = [
  { format: 'pdf', label: 'Résumé', display: 'PDF', type: 'application/pdf' },
  { format: 'docx', label: 'Résumé', display: 'Word', type: 'openxmlformats' },
  { format: 'md', label: 'Résumé', display: 'Markdown', type: 'text/markdown' },
];

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

const { data: tpl, error } = await db
  .from('templates')
  .select('id, slug, rev, data, published, custom_domain')
  .eq('slug', SLUG)
  .maybeSingle();
if (error) throw new Error(error.message);
if (!tpl) throw new Error(`No template with slug "${SLUG}".`);

const host = (tpl.custom_domain || '').trim() || `${SLUG}.quicksites.ai`;

// ── Preflight ────────────────────────────────────────────────────────────────────────────────
// Which formats are actually live RIGHT NOW at the public route. Only those get repointed; a
// format the published version does not have would otherwise become a dead button on the page.
const live = [];
for (const f of FORMATS) {
  const url = `https://${host}/api/resume/${SLUG}/${f.format}`;
  let res;
  try {
    res = await fetch(url, { method: 'GET', redirect: 'manual' });
  } catch (e) {
    console.log(`  ✗ ${f.format}: request failed (${e.message})`);
    continue;
  }
  const ct = res.headers.get('content-type') ?? '';
  const ok = res.status === 200 && ct.includes(f.type);
  console.log(`  ${ok ? '✓' : '✗'} ${f.format}: ${res.status} ${ct || '(no content-type)'}`);
  if (ok) live.push(f);
}

if (live.length === 0) {
  console.error(
    `\nRefusing to write: no format answers 200 at https://${host}/api/resume/${SLUG}/…\n` +
      `That almost always means the résumé-version code is not deployed yet. Deploy, then re-run.`
  );
  process.exit(1);
}

// ── Build the patch ──────────────────────────────────────────────────────────────────────────
const data = structuredClone(tpl.data);
const pages = data?.pages ?? [];
let found = 0;
for (const page of pages) {
  for (const block of page?.content_blocks ?? []) {
    if (block?.type !== 'file_downloads') continue;
    found++;
    const before = (block.content?.files ?? []).map((f) => f.href);
    block.content = {
      ...block.content,
      files: live.map((f) => ({
        label: f.label,
        href: `/api/resume/${SLUG}/${f.format}`,
        format: f.display,
        // ⚠️ `size` is dropped on purpose. It was measured against a fixed file; this link now
        // serves whichever version is public, so a stated size would be a number that silently
        // stops being true the first time the owner switches versions. An absent optional field
        // beats a wrong one.
      })),
    };
    console.log('\n  before:', before);
    console.log(
      '  after: ',
      block.content.files.map((f) => f.href)
    );
  }
}
if (!found) throw new Error(`No file_downloads block on "${SLUG}".`);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to commit.');
  process.exit(0);
}

// Direct UPDATEs to `templates` are trigger-blocked (CLAUDE.md §8) — go through the sanctioned RPC.
const payload = {
  id: tpl.id,
  base_rev: tpl.rev ?? 0,
  patch: { data },
  actor: null,
  kind: 'save',
  org_id: null,
};
let err = (await db.schema('public').rpc('commit_template_http', { p_payload: payload })).error;
if (err) err = (await db.schema('app').rpc('commit_template', { p_payload: payload })).error;
if (err) throw new Error(err.message);

console.log('\nCommitted. ⚠️ Republish the site for this to reach the live page — the renderer');
console.log('serves the published snapshot, not templates.data.');
