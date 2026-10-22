// scripts/guide/publish-tried-and-graded.mts — owner: "go" (2026-10-21). Publish the guide on
// www.triedandgraded.com. Same three writes that make a custom host serve a template as the B Hard
// publish (lib/tradeSites/subscriptions.ts#bindDomain shape): nominate the canonical, then
// set_template_custom_domain → publish_template → legacy `sites` row + minted snapshot (app/host
// resolves a custom host ONLY through sites.domain and serves sites.published_snapshot_id).
// The apex is redirected to www at Vercel (the graftontowing.com pattern), so one host serves.
//
//   npx tsx --env-file=.env.local scripts/guide/publish-tried-and-graded.mts
import { createHash } from 'node:crypto';
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';
// ⚠️ A custom domain is served from /sites/<domain label> (middleware.ts, 'Arbitrary custom domain → slug
// from apex label'), so the slug MUST equal the domain's label: triedandgraded.com → 'triedandgraded'.
// Published first as 'tried-and-graded' and every page 404'd on the domain until renamed (2026-10-21).
const SLUG = 'triedandgraded';
const APEX = 'triedandgraded.com';
const HOST = `www.${APEX}`;

async function vercelRedirectApex() {
  const token = process.env.VERCEL_TOKEN!;
  const team = process.env.VERCEL_TEAM_ID!;
  const proj = process.env.VERCEL_PROJECT_ID!;
  const r = await fetch(`https://api.vercel.com/v9/projects/${proj}/domains/${APEX}?teamId=${team}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ redirect: HOST, redirectStatusCode: 308 }),
  });
  const j: any = await r.json().catch(() => ({}));
  console.log(`vercel: ${APEX} → ${j.redirect ?? '?'} (${j.redirectStatusCode ?? r.status})`);
}

const { data: row0, error: e0 } = await db.from('templates').select('id, rev, data').eq('slug', SLUG).single();
if (e0 || !row0) throw new Error(`template: ${e0?.message}`);
const id = (row0 as any).id as string;
const d: any = structuredClone((row0 as any).data);
d.meta = { ...(d.meta ?? {}), canonical_origin: `https://${HOST}` };
const cErr = await commitTemplatePatch(id, (row0 as any).rev ?? 0, { data: d }, OPERATOR_ID);
if (cErr) throw new Error(`canonical commit: ${cErr}`);
const { error: rpcErr } = await db.rpc('set_template_custom_domain', { p_template_id: id, p_domain: HOST });
if (rpcErr) throw new Error(`set_template_custom_domain: ${rpcErr.message}`);
const { error: pubErr } = await db.rpc('publish_template', { p_template_id: id, p_version_id: null, p_actor: OPERATOR_ID });
if (pubErr) throw new Error(`publish_template: ${pubErr.message}`);

const { data: tpl } = await db.from('templates').select('*').eq('id', id).single();
const COLS = ['editor_email','template_name','data','brand','theme','branding_profile_id','color_scheme','template_id','thumbnail_url','owner_id','template_slug','industry','layout','is_site','meta','color_mode','header_block','footer_block','services_jsonb','contact_email','business_name','address_line1','address_line2','city','state','postal_code','latitude','longitude','phone','domain','custom_domain','logo_url','hero_url','banner_url'];
const { data: top } = await db.from('snapshots').select('rev').eq('template_id', id).order('rev', { ascending: false }).limit(1).maybeSingle();
const snap: Record<string, unknown> = {};
for (const k of COLS) if (k in (tpl as any)) snap[k] = (tpl as any)[k];
Object.assign(snap, {
  template_id: id,
  template_slug: (tpl as any).slug,
  custom_domain: HOST,
  rev: Math.max(Number((tpl as any).rev ?? 0), Number((top as any)?.rev ?? 0)) + 1,
  commit_message: 'Tried & Graded — www.triedandgraded.com bound (owner: go)',
  created_at: new Date().toISOString(),
  published: true,
  hash: createHash('sha256').update(JSON.stringify((tpl as any).data ?? {})).digest('hex'),
});
const { data: s, error: sErr } = await db.from('snapshots').insert(snap).select('id').single();
if (sErr) throw new Error(`snapshot: ${sErr.message}`);
const { data: existing } = await db.from('sites').select('id').or(`template_id.eq.${id},domain.eq.${HOST},domain.eq.${APEX}`).limit(1).maybeSingle();
const siteRow = { slug: (tpl as any).slug, domain: HOST, template_id: id, business_name: (tpl as any).business_name ?? null, owner_id: (tpl as any).owner_id ?? null, is_published: true, published_snapshot_id: (s as any).id, published_rev: snap.rev, published_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const { error: siteErr } = (existing as any)?.id ? await db.from('sites').update(siteRow).eq('id', (existing as any).id) : await db.from('sites').insert(siteRow);
if (siteErr) throw new Error(`sites row: ${siteErr.message}`);
await vercelRedirectApex();

const { data: after } = await db.from('templates').select('published, custom_domain, rev').eq('id', id).single();
const { data: ps } = await db.from('published_sites').select('domain, updated_at').eq('template_id', id).maybeSingle();
console.log(JSON.stringify({ template: after, published_sites: ps, snapshot: (s as any).id, sites_row: (existing as any)?.id ? 'updated' : 'inserted' }));
