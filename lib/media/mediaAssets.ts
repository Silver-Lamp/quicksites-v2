// lib/media/mediaAssets.ts
//
// Pure data-access for the media-asset registry (see supabase/migrations/
// 20260720_media_assets.sql). The table is RLS-denied → every call here runs
// through the service-role admin client and route-level authorization is
// load-bearing (CLAUDE.md §6). `media_assets` is not in types/supabase.ts, so
// the admin client is passed in untyped.

import { resolveIndustryKey } from '@/lib/industries';

// Untyped service-role client (supabaseAdmin). Kept `any` on purpose — media_assets
// is a post-regen table absent from the generated Database types.
type Admin = any;

export type MediaScope = 'site' | 'org-industry' | 'org' | 'public';

export type MediaAsset = {
  id: string;
  url: string;
  subject: string | null;
  kind: string;
  created_at: string;
};

const LIST_LIMIT = 120;

/**
 * Record one image in the registry. Org / owner / industry are re-derived from
 * the template row server-side (never trusted from the client) — matching the
 * re-fetch pattern in app/api/hero/generate-image/route.ts. Upserts on `url`
 * so repeated records + backfill are idempotent. Best-effort: returns false on
 * any soft failure rather than throwing, so callers never block the editor.
 */
export async function recordMediaAsset(
  admin: Admin,
  input: {
    templateId: string;
    url: string;
    storagePath?: string | null;
    kind?: string;
    source?: 'generated' | 'uploaded';
    subject?: string | null;
    width?: number | null;
    height?: number | null;
  }
): Promise<boolean> {
  const url = (input.url || '').trim();
  const templateId = (input.templateId || '').trim();
  if (!url || !templateId) return false;

  let orgId: string | null = null;
  let ownerId: string | null = null;
  let industry: string | null = null;

  const { data: tpl } = await admin
    .from('templates')
    .select('org_id, owner_id, industry, data')
    .eq('id', templateId)
    .maybeSingle();

  if (tpl) {
    orgId = tpl.org_id ?? null;
    ownerId = tpl.owner_id ?? null;
    const rawIndustry =
      tpl.industry ??
      tpl?.data?.meta?.identity?.industry ??
      tpl?.data?.meta?.industry ??
      null;
    industry = rawIndustry ? resolveIndustryKey(rawIndustry) : null;
  }

  const row = {
    template_id: templateId,
    org_id: orgId,
    owner_id: ownerId,
    industry,
    url,
    storage_path: input.storagePath ?? null,
    kind: input.kind ?? 'hero',
    source: input.source ?? 'generated',
    subject: input.subject ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
  };

  const { error } = await admin
    .from('media_assets')
    .upsert(row, { onConflict: 'url', ignoreDuplicates: true });

  return !error;
}

/**
 * Record an operator-owned image that isn't attached to any template — e.g. an outreach
 * headshot or signature. Scoped only by `owner_id` (no template/org/industry), so it shows
 * up under the "All my sites" (org) scope in the picker for reuse. Idempotent on `url`.
 */
export async function recordOwnerMediaAsset(
  admin: Admin,
  input: { ownerId: string; url: string; kind: string; storagePath?: string | null; subject?: string | null }
): Promise<boolean> {
  const url = (input.url || '').trim();
  const ownerId = (input.ownerId || '').trim();
  if (!url || !ownerId) return false;
  const { error } = await admin.from('media_assets').upsert(
    {
      owner_id: ownerId,
      org_id: null,
      template_id: null,
      industry: null,
      url,
      storage_path: input.storagePath ?? null,
      kind: input.kind || 'other',
      source: 'uploaded',
      subject: input.subject ?? null,
    },
    { onConflict: 'url', ignoreDuplicates: true }
  );
  return !error;
}

/**
 * List thumbnails for a scope. Scoping is intentionally owner-first: "my org" is
 * every site I own plus any template whose org_id is in `orgIds` (the distinct
 * org_ids of my own templates) — this avoids a separate membership model and
 * still covers org_id-null rows (guest builds). `public` = images attached to a
 * currently-published template (join, so it tracks publish state live).
 */
export async function listMediaAssets(
  admin: Admin,
  opts: {
    scope: MediaScope;
    userId: string;
    orgIds: string[];
    templateId?: string | null;
    industry?: string | null;
    kind?: string | null;
  }
): Promise<MediaAsset[]> {
  const project = 'id, url, subject, kind, created_at';

  const orFilter = () => {
    const clauses = [`owner_id.eq.${opts.userId}`];
    for (const oid of opts.orgIds) if (oid) clauses.push(`org_id.eq.${oid}`);
    return clauses.join(',');
  };

  const kind = opts.kind ? String(opts.kind) : null;

  if (opts.scope === 'public') {
    let pq = admin
      .from('media_assets')
      .select(`${project}, templates!inner(published)`)
      .eq('templates.published', true);
    if (kind) pq = pq.eq('kind', kind);
    const { data, error } = await pq
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);
    if (error) return [];
    return (data ?? []).map(stripJoin);
  }

  let q = admin.from('media_assets').select(project);
  if (kind) q = q.eq('kind', kind);

  if (opts.scope === 'site') {
    if (!opts.templateId) return [];
    q = q.eq('template_id', opts.templateId);
  } else {
    q = q.or(orFilter());
    if (opts.scope === 'org-industry') {
      const key = opts.industry ? resolveIndustryKey(opts.industry) : '';
      if (!key) return [];
      q = q.eq('industry', key);
    }
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(LIST_LIMIT);
  if (error) return [];
  return (data ?? []).map(stripJoin);
}

function stripJoin(r: any): MediaAsset {
  return {
    id: r.id,
    url: r.url,
    subject: r.subject ?? null,
    kind: r.kind ?? 'hero',
    created_at: r.created_at,
  };
}

/**
 * The distinct org_ids of a user's own templates — the set that defines "my org"
 * for read scoping. Cheap, reuses existing data (no membership table).
 */
export async function resolveUserOrgIds(admin: Admin, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('templates')
    .select('org_id')
    .eq('owner_id', userId)
    .not('org_id', 'is', null);
  const set = new Set<string>();
  for (const r of data ?? []) if (r?.org_id) set.add(r.org_id as string);
  return [...set];
}
