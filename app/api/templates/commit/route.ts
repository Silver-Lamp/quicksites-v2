// app/api/templates/commit/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { diffBlocks } from '@/lib/diff/blocks';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

// optional org (keeps single-tenant working)
let resolveOrg: undefined | (() => Promise<any>);
try { resolveOrg = require('@/lib/org/resolveOrg').resolveOrg; } catch {}

/* ---------------- utilities ---------------- */

type Kind = 'save' | 'autosave';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const isMergeConflict = (m: string) =>
  typeof m === 'string' && (m.includes('merge_conflict') || /conflict/i.test(m));

/** Recursively drop empty-string values, to avoid "clearing" columns by accident. */
function stripEmpty(v: any): any {
  if (v === '') return undefined;
  if (Array.isArray(v)) return v.map(stripEmpty);
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      const n = stripEmpty(val);
      if (n !== undefined) out[k] = n;
    }
    return out;
  }
  return v;
}

const DEBUG_ID = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG_ID) console.log(...args); };

/** Safe/forgiving JSON-ish getter */
function obj(v: any) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

/* ---------------- meta / industry helpers ---------------- */

/** lightweight slugifier (keeps ascii, numbers, underscores, hyphens) */
function toSlug(s: any): string | null {
  if (s == null) return null;
  const raw = String(s).trim().toLowerCase();
  if (!raw) return null;
  // convert spaces to underscores and collapse
  const slug = raw
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || null;
}

/** Title-ize a slug if we don't get an explicit label */
function humanizeSlug(slug: string): string {
  return slug
    .split(/[_-]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Normalize the "industry" triplet:
 *  - Prefer an explicit incoming key (even if we don't recognize it globally).
 *  - Never downgrade a previously specific key to "other" unless the incoming
 *    patch explicitly asks for "other" (or provides other-text only).
 *  - Provide a sensible label if absent.
 */
function normalizeIndustryTriplet(
  incomingMeta: any,
  beforeMeta: any
): { industry?: string | null; industry_label?: string | null; industry_other?: string | null } {
  const inKeyRaw = incomingMeta?.industry;
  const inKeySlug = toSlug(inKeyRaw);
  const inLabel = (incomingMeta?.industry_label ?? '').toString().trim() || null;
  const inOther = (incomingMeta?.industry_other ?? '').toString().trim() || null;

  const prevKeyRaw = beforeMeta?.industry;
  const prevKeySlug = toSlug(prevKeyRaw);
  const prevLabel = (beforeMeta?.industry_label ?? '').toString().trim() || null;
  const prevOther = (beforeMeta?.industry_other ?? '').toString().trim() || null;

  // CASE 1: Caller explicitly set a key
  if (inKeySlug) {
    if (inKeySlug === 'other') {
      // Explicitly "other"
      const otherText = inOther || null;
      return {
        industry: 'other',
        industry_label: inLabel || 'Other',
        industry_other: otherText,
      };
    }
    // Any non-"other" slug is treated as a valid specific industry
    return {
      industry: inKeySlug,
      industry_label: inLabel || humanizeSlug(inKeySlug),
      industry_other: null,
    };
  }

  // CASE 2: No incoming key, but "other" text was provided
  if (inOther && !inKeySlug) {
    return {
      industry: 'other',
      industry_label: 'Other',
      industry_other: inOther,
    };
  }

  // CASE 3: No incoming changes — keep previous triplet as-is
  if (prevKeySlug) {
    if (prevKeySlug === 'other') {
      return {
        industry: 'other',
        industry_label: prevLabel || 'Other',
        industry_other: prevOther || null,
      };
    }
    return {
      industry: prevKeySlug,
      industry_label: prevLabel || humanizeSlug(prevKeySlug),
      industry_other: null,
    };
  }

  // CASE 4: No info at all; return empty so caller's merge doesn't overwrite
  return {};
}

/** Restrict meta keys we explicitly support merging at this layer. */
const ALLOWED_META_KEYS = new Set<string>([
  // identity mirror container
  'identity',
  // industry triplet
  'industry',
  'industry_label',
  'industry_other',
  // other known knobs we tolerate at this layer (extend as needed)
  'site_type',
  'siteTitle',
  'business',
  'contact',
  'services',
]);

/** Merge identity -> meta.identity and legacy meta fields; backfill missing columns from identity.
 *  Additionally: normalize the industry triplet so we don't silently downgrade to "other".
 */
function enrichPatchWithIdentity(originalPatch: any, beforeData: any) {
  const patch = { ...(originalPatch || {}) };
  const inData = obj(patch.data);
  const inMeta = obj(inData.meta);
  const beforeMeta = obj(beforeData?.meta);

  // DEBUG: show incoming meta payload to help catch drops
  if (DEBUG_ID) {
    dbg('[IDENTITY:API] patch.meta =', JSON.stringify(inMeta));
  }

  const idFromData = obj(inData.identity);
  const idFromMeta = obj(inMeta.identity);
  const identity =
    Object.keys(idFromData).length ? idFromData :
    (Object.keys(idFromMeta).length ? idFromMeta : null);

  // Build contact snapshot if identity present
  const contact = obj(identity?.contact);
  const prevMetaIdentity = obj(beforeMeta.identity);
  const mergedMetaIdentity = { ...prevMetaIdentity, ...idFromMeta, ...idFromData };

  // Start with a conservative merged meta (keep previous, then incoming)
  const metaBase: any = { ...beforeMeta, ...inMeta };

  // Keep legacy meta fields aligned for older readers / prompts (fill if provided)
  metaBase.siteTitle = identity?.template_name ?? metaBase.siteTitle ?? null;
  metaBase.business  = identity?.business_name ?? metaBase.business ?? null;
  metaBase.site_type = identity?.site_type ?? metaBase.site_type ?? null;

  // Normalize industry triplet using both incoming and previous values
  const normIndustry = normalizeIndustryTriplet(inMeta, beforeMeta);

  // Compose nextMeta with whitelisted keys plus normalized industry
  const nextMeta: any = {};
  for (const k of Object.keys(metaBase)) {
    if (ALLOWED_META_KEYS.has(k)) nextMeta[k] = metaBase[k];
  }
  nextMeta.identity = mergedMetaIdentity; // always keep identity mirror
  if (normIndustry.industry !== undefined)       nextMeta.industry = normIndustry.industry;
  if (normIndustry.industry_label !== undefined) nextMeta.industry_label = normIndustry.industry_label;
  if (normIndustry.industry_other !== undefined) nextMeta.industry_other = normIndustry.industry_other;

  // Keep contact sub-object in meta (non-destructive)
  nextMeta.contact = {
    ...(obj(beforeMeta.contact)),
    ...(obj(inMeta.contact)),
    email:     contact.email     ?? inMeta?.contact?.email     ?? beforeMeta?.contact?.email     ?? null,
    phone:     contact.phone     ?? inMeta?.contact?.phone     ?? beforeMeta?.contact?.phone     ?? null,
    address:   contact.address   ?? inMeta?.contact?.address   ?? beforeMeta?.contact?.address   ?? null,
    address2:  contact.address2  ?? inMeta?.contact?.address2  ?? beforeMeta?.contact?.address2  ?? null,
    city:      contact.city      ?? inMeta?.contact?.city      ?? beforeMeta?.contact?.city      ?? null,
    state:     contact.state     ?? inMeta?.contact?.state     ?? beforeMeta?.contact?.state     ?? null,
    postal:    contact.postal    ?? inMeta?.contact?.postal    ?? beforeMeta?.contact?.postal    ?? null,
    latitude:  contact.latitude  ?? inMeta?.contact?.latitude  ?? beforeMeta?.contact?.latitude  ?? null,
    longitude: contact.longitude ?? inMeta?.contact?.longitude ?? beforeMeta?.contact?.longitude ?? null,
  };

  // Also keep a data.identity snapshot (non-breaking)
  const nextData = {
    ...inData,
    identity: { ...(obj(inData.identity)), ...mergedMetaIdentity },
    meta: nextMeta,
  };

  // Backfill columns ONLY if caller didn't already set them in patch
  const setIfUndef = (k: string, v: any) => {
    if (patch[k] === undefined && v !== undefined && v !== null && v !== '') {
      patch[k] = v;
    }
  };

  setIfUndef('template_name', identity?.template_name);
  setIfUndef('business_name', identity?.business_name);
  setIfUndef('site_type', identity?.site_type);

  // Prefer normalized meta industry for columns; fall back to identity
  const colIndustry = normIndustry.industry ?? identity?.industry;
  const colIndustryLabel = normIndustry.industry_label ?? identity?.industry_label;

  setIfUndef('industry', colIndustry);
  setIfUndef('industry_label', colIndustryLabel);

  setIfUndef('contact_email', contact.email);
  setIfUndef('phone', contact.phone);

  setIfUndef('address_line1', contact.address);
  setIfUndef('address_line2', contact.address2);
  setIfUndef('city', contact.city);
  setIfUndef('state', contact.state);
  setIfUndef('postal_code', contact.postal);

  if (contact.latitude !== undefined && contact.latitude !== null && contact.latitude !== '') {
    setIfUndef('latitude', contact.latitude);
  }
  if (contact.longitude !== undefined && contact.longitude !== null && contact.longitude !== '') {
    setIfUndef('longitude', contact.longitude);
  }

  patch.data = nextData;

  dbg('[IDENTITY:API] enriched patch from identity', {
    columns: {
      template_name: patch.template_name,
      site_type: patch.site_type,
      industry: patch.industry,
      industry_label: patch.industry_label,
      contact_email: patch.contact_email,
      phone: patch.phone,
      address_line1: patch.address_line1,
      address_line2: patch.address_line2,
      city: patch.city,
      state: patch.state,
      postal_code: patch.postal_code,
      latitude: patch.latitude,
      longitude: patch.longitude,
    },
    identity_in_data: nextData.identity,
    identity_in_meta: nextData.meta.identity,
    normalized_industry: normIndustry,
  });

  return patch;
}

/** Canonical projection (columns + data) for post-commit rehydrate. */
const TEMPLATE_EDITOR_SELECT = [
  'id',
  'slug',
  'base_slug',
  'rev',
  'updated_at',
  'template_name',
  'business_name',
  'industry',
  'industry_label',
  'site_type',
  'site_type_key',
  'site_type_label',
  'contact_email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'latitude',
  'longitude',
  'color_mode',
  'color_scheme',
  'layout',
  'data',
].join(', ');

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { id, baseRev, patch: rawPatch, kind } = body as {
      id: string;
      baseRev?: number;
      patch: Record<string, any>;
      kind?: Kind;
    };

    if (!id || typeof id !== 'string') return j({ error: 'id required' }, 400);
    if (!rawPatch || typeof rawPatch !== 'object') return j({ error: 'patch required (object)' }, 400);

    // sanitize forbidden fields
    try {
      delete (rawPatch as any).base_slug;
      delete (rawPatch as any).is_version;
      delete (rawPatch as any).rev;
      delete (rawPatch as any).updated_at;
      delete (rawPatch as any).created_at;
      delete (rawPatch as any).owner_id;
      delete (rawPatch as any).published_version_id;
    } catch {}

    // before state for hash/diff and meta merge
    const { data: beforeRow, error: beforeErr } = await supabaseAdmin
      .from('templates')
      .select('rev, data')
      .eq('id', id)
      .single();

    if (beforeErr || !beforeRow) {
      return j({ error: beforeErr?.message || 'template not found' }, 404);
    }

    const beforeRev = typeof (beforeRow as any).rev === 'number' ? (beforeRow as any).rev : 0;
    const beforeData = (beforeRow as any).data ?? {};
    const effectiveBaseRev = Number.isFinite(baseRev as number) ? (baseRev as number) : beforeRev;

    // optional org context
    let orgId: string | undefined;
    try {
      if (resolveOrg) {
        const org = await resolveOrg();
        if (org?.id) orgId = String(org.id);
      }
    } catch {}

    // Enrich patch with identity mirrors & column backfills (non-destructive)
    if (DEBUG_ID) {
      dbg('[IDENTITY:API] incoming patch', { id, baseRev: effectiveBaseRev, patch: rawPatch });
    }
    const enrichedPatch = enrichPatchWithIdentity(rawPatch, beforeData);

    // Build payload for your public HTTP wrapper (delegates to app.commit_template)
    const payload = {
      id,
      base_rev: effectiveBaseRev,
      patch: stripEmpty(enrichedPatch ?? {}),
      actor: null,
      kind: (kind ?? 'save') as Kind,
      org_id: orgId,
    };

    if (DEBUG_ID) {
      dbg('[IDENTITY:API] payload to RPC', payload);
    }

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc(
      'commit_template_http',
      { p_payload: payload } as any
    );

    if (rpcErr) {
      const msg = String(rpcErr.message || 'commit failed');

      if (isMergeConflict(msg)) {
        const { data: curRow } = await supabaseAdmin
          .from('templates')
          .select('rev')
          .eq('id', id)
          .maybeSingle();
        const currentRev =
          (curRow && typeof (curRow as any).rev === 'number' && (curRow as any).rev) || beforeRev;

        if (DEBUG_ID) dbg('[IDENTITY:API] merge conflict', { id, beforeRev, currentRev });
        return j({ error: 'merge_conflict', rev: currentRev }, 409);
      }

      if (DEBUG_ID) dbg('[IDENTITY:API] RPC error', { id, error: msg });
      return j(
        {
          error: 'commit failed',
          rpc_error: msg,
          rpc_attempt: 'public.commit_template_http(p_payload jsonb)',
          hint: 'Ensure the PUBLIC wrapper exists and delegates to app.commit_template(jsonb).',
        },
        500
      );
    }

    // next rev (prefer DB-returned rev)
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const nextRev =
      typeof row?.rev === 'number'
        ? row.rev
        : Number.isFinite(effectiveBaseRev)
        ? (effectiveBaseRev as number) + 1
        : beforeRev + 1;

    // Re-select authoritative row for client rehydrate (columns + data)
    const { data: fullRow, error: selErr } = await supabaseAdmin
      .from('templates')
      .select(TEMPLATE_EDITOR_SELECT)
      .eq('id', id)
      .single();

    // If selection fails, still respond with rev/hash from data-only fetch
    if (selErr || !fullRow) {
      const { data: cur2 } = await supabaseAdmin
        .from('templates')
        .select('data')
        .eq('id', id)
        .single();
      const afterData2 = (cur2 as any)?.data ?? {};
      const hash2 = sha256(afterData2);

      if (DEBUG_ID) dbg('[IDENTITY:API] post-commit select failed; returning fallback', { id, nextRev, hash2 });
      return j({ id, rev: nextRev, hash: hash2, kind: kind ?? 'save' });
    }

    // Normalize site_type across possible fields (column/key/meta)
    const normalizedSiteType: string | null =
      (fullRow as any).site_type ??
      (fullRow as any).site_type_key ??
      ((fullRow as any).data?.meta?.site_type ?? null);

    // Hash + diff + log
    const afterData = (fullRow as any)?.data ?? {};
    const hash = sha256(afterData);

    try {
      const bd = diffBlocks({ data: beforeData }, { data: afterData });
      const afterMeta = (afterData as any)?.meta ?? {};
      await logTemplateEvent({
        templateId: id,
        type: (kind === 'autosave' ? 'autosave' : 'save') as Kind,
        revBefore: beforeRev,
        revAfter: nextRev,
        diff: {
          added: bd.added.length,
          changed: bd.modified.length,
          removed: bd.removed.length,
        },
        meta: {
          blockDiff: {
            addedByType: bd.addedByType,
            modifiedByType: bd.modifiedByType,
            removedByType: bd.removedByType,
            added: bd.added.slice(0, 3),
            modified: bd.modified.slice(0, 3),
            removed: bd.removed.slice(0, 3),
          },
          industry:
            (fullRow as any).industry ??
            (typeof afterMeta?.industry === 'string' ? afterMeta.industry : undefined),
          services:
            Array.isArray((afterData as any)?.services)
              ? (afterData as any).services
              : afterMeta?.services ?? undefined,
          before: { rev: beforeRev, data: beforeData },
          after: { rev: nextRev, data: afterData },
        },
      } as any);
    } catch (e) {
      // best-effort logging; ignore failures
      if (DEBUG_ID) dbg('[IDENTITY:API] logTemplateEvent failed (ignored)', { error: (e as any)?.message });
    }

    if (DEBUG_ID) {
      const data = (fullRow as any)?.data ?? {};
      dbg('[IDENTITY:API] success', {
        id,
        nextRev,
        site_type: normalizedSiteType,
        meta_identity: data?.meta?.identity,
        data_identity: data?.identity,
      });
    }

    // Return rev + normalized template so client can merge without a follow-up fetch
    return j({
      id,
      rev: nextRev,
      hash,
      kind: kind ?? 'save',
      template: {
        ...(fullRow as any),
        site_type: normalizedSiteType,
      },
    });
  } catch (e: any) {
    if (DEBUG_ID) dbg('[IDENTITY:API] fatal error', { error: e?.message });
    return j({ error: e?.message || 'commit failed' }, 500);
  }
}
