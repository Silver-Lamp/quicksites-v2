// scripts/lib/republishTemplate.mjs
//
// Commit a rewritten `data` tree to a template and push it to the public page — INCLUDING the
// legacy `sites` snapshot, without which a custom domain never changes.
//
// ⚠️ A custom domain is served from sites.published_snapshot_id, which NO publish path writes.
// #857 and #906 both learned this: commit + publish_template_demo reaches the database and never the
// page. So after publishing we mint a new snapshot from the pinned one (with the same rewrite
// applied) and repoint the row. Never null the pointer — that 404'd a position-1 domain once.
import crypto from 'node:crypto';
import fs from 'node:fs';

export function loadEnv(path = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8').split('\n')
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
  );
}

export function makeRest(env) {
  const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  return async function rest(path, init = {}) {
    const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
    const text = await res.text();
    // ⚠️ Read the error. #906 found a 72 MB query whose failure was destructured away and reported
    // as "no data" — a lookup failure wearing the costume of a data problem.
    if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}

/**
 * @param rest       from makeRest
 * @param tpl        { id, slug, rev }
 * @param data       the rewritten data tree to commit
 * @param transform  (obj) => void — applies the SAME rewrite in place to the legacy snapshot
 * @param message    commit message for the minted snapshot
 * @returns { repointed: string | null }
 */
export async function republishTemplate(rest, tpl, data, transform, message) {
  await rest('rpc/commit_template_http', {
    method: 'POST',
    body: JSON.stringify({
      p_payload: { id: tpl.id, base_rev: tpl.rev ?? 0, patch: { data }, actor: null, kind: 'save', org_id: null },
    }),
  });
  await rest('rpc/publish_template_demo', { method: 'POST', body: JSON.stringify({ p_template_id: tpl.id }) });

  const [legacy] = await rest(`sites?select=id,published_snapshot_id&slug=eq.${encodeURIComponent(tpl.slug)}`);
  if (!legacy?.published_snapshot_id) return { repointed: null };
  const [pinned] = await rest(`snapshots?select=*&id=eq.${legacy.published_snapshot_id}`);
  if (!pinned) return { repointed: null };

  const clean = structuredClone(pinned);
  transform(clean);
  clean.id = crypto.randomUUID();
  clean.created_at = new Date().toISOString();
  // (template_id, rev) is unique; ask the table for its high-water mark rather than reusing tpl.rev.
  const [top] = await rest(`snapshots?select=rev&template_id=eq.${tpl.id}&order=rev.desc&limit=1`);
  clean.rev = Math.max(tpl.rev ?? 0, top?.rev ?? 0) + 1;
  clean.commit_message = message;
  await rest('snapshots', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(clean) });
  await rest(`sites?id=eq.${legacy.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ published_snapshot_id: clean.id }),
  });
  return { repointed: clean.id };
}
