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

/* ───────────────────────────── helpers ───────────────────────────── */

type Kind = 'save' | 'autosave';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const DEBUG_ID = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG_ID) console.log(...args); };

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

/** forgiving parse */
function obj(v: any) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

/* ─────────────── industry helpers (same semantics as your state route) ─────────────── */

function toSlug(s: any): string | null {
  if (s == null) return null;
  const raw = String(s).trim().toLowerCase();
  if (!raw) return null;
  const slug = raw
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || null;
}
function humanizeSlug(slug: string): string {
  return slug.split(/[_-]/g).filter(Boolean).map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

function normalizeIndustryTriplet(incomingMeta: any, beforeMeta: any) {
  const inKeySlug = toSlug(incomingMeta?.industry);
  const inLabel = (incomingMeta?.industry_label ?? '').toString().trim() || null;
  const inOther = (incomingMeta?.industry_other ?? '').toString().trim() || null;

  const prevKeySlug = toSlug(beforeMeta?.industry);
  const prevLabel = (beforeMeta?.industry_label ?? '').toString().trim() || null;
  const prevOther = (beforeMeta?.industry_other ?? '').toString().trim() || null;

  if (inKeySlug) {
    if (inKeySlug === 'other') {
      return { industry: 'other', industry_label: inLabel || 'Other', industry_other: inOther || null };
    }
    return { industry: inKeySlug, industry_label: inLabel || humanizeSlug(inKeySlug), industry_other: null };
  }
  if (inOther && !inKeySlug) return { industry: 'other', industry_label: 'Other', industry_other: inOther };
  if (prevKeySlug) {
    if (prevKeySlug === 'other') return { industry: 'other', industry_label: prevLabel || 'Other', industry_other: prevOther || null };
    return { industry: prevKeySlug, industry_label: prevLabel || humanizeSlug(prevKeySlug), industry_other: null };
  }
  return {};
}

const ALLOWED_META_KEYS = new Set<string>([
  'identity', 'industry', 'industry_label', 'industry_other',
  'site_type', 'siteTitle', 'business', 'contact', 'services',
]);

/** Merge identity mirrors + keep columns in sync; normalize industry triplet. */
function enrichPatchWithIdentity(originalPatch: any, beforeData: any) {
  const patch = { ...(originalPatch || {}) };
  const inData = obj(patch.data);
  const inMeta = obj(inData.meta);
  const beforeMeta = obj(beforeData?.meta);

  if (DEBUG_ID) dbg('[IDENTITY:API] patch.meta =', JSON.stringify(inMeta));

  const idFromData = obj(inData.identity);
  const idFromMeta = obj(inMeta.identity);
  const identity = Object.keys(idFromData).length ? idFromData : (Object.keys(idFromMeta).length ? idFromMeta : null);

  const contact = obj(identity?.contact);
  const prevMetaIdentity = obj(beforeMeta.identity);
  const mergedMetaIdentity = { ...prevMetaIdentity, ...idFromMeta, ...idFromData };

  const metaBase: any = { ...beforeMeta, ...inMeta };
  metaBase.siteTitle = identity?.template_name ?? metaBase.siteTitle ?? null;
  metaBase.business  = identity?.business_name ?? metaBase.business ?? null;
  metaBase.site_type = identity?.site_type ?? metaBase.site_type ?? null;

  const normIndustry = normalizeIndustryTriplet(inMeta, beforeMeta);

  const nextMeta: any = {};
  for (const k of Object.keys(metaBase)) if (ALLOWED_META_KEYS.has(k)) nextMeta[k] = metaBase[k];
  nextMeta.identity = mergedMetaIdentity;
  if (normIndustry.industry        !== undefined) nextMeta.industry        = normIndustry.industry;
  if (normIndustry.industry_label  !== undefined) nextMeta.industry_label  = normIndustry.industry_label;
  if (normIndustry.industry_other  !== undefined) nextMeta.industry_other  = normIndustry.industry_other;

  nextMeta.contact = {
    ...(obj(beforeMeta.contact)), ...(obj(inMeta.contact)),
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

  const nextData = { ...inData, identity: { ...(obj(inData.identity)), ...mergedMetaIdentity }, meta: nextMeta };

  const setIfUndef = (k: string, v: any) => { if ((patch as any)[k] === undefined && v !== undefined && v !== null && v !== '') (patch as any)[k] = v; };

  setIfUndef('template_name', identity?.template_name);
  setIfUndef('business_name', identity?.business_name);
  setIfUndef('site_type', identity?.site_type);

  const colIndustry      = normIndustry.industry      ?? identity?.industry;
  const colIndustryLabel = normIndustry.industry_label?? identity?.industry_label;
  setIfUndef('industry', colIndustry);
  setIfUndef('industry_label', colIndustryLabel);

  setIfUndef('contact_email',  contact.email);
  setIfUndef('phone',          contact.phone);
  setIfUndef('address_line1',  contact.address);
  setIfUndef('address_line2',  contact.address2);
  setIfUndef('city',           contact.city);
  setIfUndef('state',          contact.state);
  setIfUndef('postal_code',    contact.postal);
  if (contact.latitude  !== undefined && contact.latitude  !== null && contact.latitude  !== '') setIfUndef('latitude',  contact.latitude);
  if (contact.longitude !== undefined && contact.longitude !== null && contact.longitude !== '') setIfUndef('longitude', contact.longitude);

  (patch as any).data = nextData;
  return patch;
}

/** Projection for rehydrate. */
const TEMPLATE_EDITOR_SELECT = [
  'id','slug','base_slug','rev','updated_at',
  'template_name','business_name','industry','industry_label',
  'site_type','site_type_key','site_type_label',
  'contact_email','phone','address_line1','address_line2','city','state','postal_code',
  'latitude','longitude','color_mode','color_scheme','layout','data',
].join(', ');

/* ──────────────── RPC helpers (return last error so we can inspect it) ──────────────── */

type RpcResult = { ok: true } | { ok: false; error: any };

async function callRpc(schema: 'public'|'app', fn: string, args: Record<string, any>): Promise<RpcResult> {
  const cli = supabaseAdmin.schema(schema);
  const { error } = await cli.rpc(fn, args as any);
  return error ? { ok: false, error } : { ok: true };
}

function looksLikeConflict(e: any) {
  const m = String(e?.message || '').toLowerCase();
  return (
    m.includes('merge_conflict') ||
    (m.includes('conflict') && (m.includes('rev') || m.includes('version') || m.includes('rebase'))) ||
    m.includes('stale') || m.includes('concurrent')
  );
}

/* ────────────────────────────────── ROUTE ────────────────────────────────── */

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
    for (const k of ['base_slug','is_version','rev','updated_at','created_at','owner_id','published_version_id']) delete (rawPatch as any)[k];

    const pub = supabaseAdmin.schema('public');

    // before state
    const { data: beforeRow, error: beforeErr } = await pub
      .from('templates')
      .select('rev,data')
      .eq('id', id)
      .single();
    if (beforeErr || !beforeRow) return j({ error: beforeErr?.message || 'template not found' }, 404);

    const beforeRev = typeof (beforeRow as any).rev === 'number' ? (beforeRow as any).rev : 0;
    const beforeData = (beforeRow as any).data ?? {};
    const effectiveBaseRev = Number.isFinite(baseRev as number) ? (baseRev as number) : beforeRev;

    // optional org
    let orgId: string | undefined;
    try { if (resolveOrg) { const org = await resolveOrg(); if (org?.id) orgId = String(org.id); } } catch {}

    // enrich patch + strip empties
    if (DEBUG_ID) dbg('[IDENTITY:API] incoming patch', { id, baseRev: effectiveBaseRev, patch: rawPatch });
    const enrichedPatch = enrichPatchWithIdentity(rawPatch, beforeData);
    const strippedPatch = stripEmpty(enrichedPatch ?? {});

    const payload = {
      id,
      base_rev: effectiveBaseRev,
      patch: strippedPatch,
      actor: null,
      kind: (kind ?? 'save') as Kind,
      org_id: orgId ?? null,
    };

    // ── RPC tries in your environment (from your catalog) ──
    let lastErr: any = null;

    // 1) public.commit_template_http(p_payload)
    let r = await callRpc('public','commit_template_http', { p_payload: payload });
    if (r.ok) lastErr = null; else lastErr = r.error;

    // 2) app.commit_template(p_payload jsonb)
    if (lastErr) { r = await callRpc('app','commit_template', { p_payload: payload }); lastErr = r.ok ? null : r.error; }

    // 3) app.commit_template(p_id,p_base_rev,p_patch,p_actor)
    if (lastErr) { r = await callRpc('app','commit_template', { p_id: id, p_base_rev: payload.base_rev, p_patch: strippedPatch, p_actor: null }); lastErr = r.ok ? null : r.error; }

    // 4) app.commit_template(..., p_kind)
    if (lastErr) { r = await callRpc('app','commit_template', { p_id: id, p_base_rev: payload.base_rev, p_patch: strippedPatch, p_actor: null, p_kind: payload.kind }); lastErr = r.ok ? null : r.error; }

    // 5) public.commit_template_patch(p_id, p_base_rev, p_patch, p_actor, p_kind)
    if (lastErr) { r = await callRpc('public','commit_template_patch', { p_id: id, p_base_rev: payload.base_rev, p_patch: strippedPatch, p_actor: null, p_kind: payload.kind }); lastErr = r.ok ? null : r.error; }

    // 6) legacy public.commit_template(template_id, patch, actor_id, reason)  (no base_rev)
    if (lastErr) { r = await callRpc('public','commit_template', { template_id: id, patch: strippedPatch, actor_id: null, reason: 'editor save' }); lastErr = r.ok ? null : r.error; }

    if (lastErr) {
      // Refresh current server rev to decide rebase vs guard
      const { data: curRow } = await pub.from('templates').select('rev').eq('id', id).maybeSingle();
      const currentRev = (curRow && typeof (curRow as any).rev === 'number') ? (curRow as any).rev : beforeRev;
      const revMismatch = currentRev !== effectiveBaseRev;

      if (revMismatch || looksLikeConflict(lastErr)) {
        // Tell client to retry with current rev (commitWithRebase expects "latest")
        return j({
          conflict: true,
          error: 'merge_conflict',
          rev: currentRev,
          latest: { id, baseRev: currentRev, patch: strippedPatch, kind: kind ?? 'save' },
        }, 409);
      }

      // Not a rebase-able conflict → guard/exposure issue
      return j({
        error: 'guard_blocked',
        message:
          'Direct updates are blocked or RPC is not exposed. Expose one of: public.commit_template_http(p_payload), app.commit_template(p_payload) or compatible commit_template(...).',
        detail: String(lastErr?.message || lastErr),
      }, 409);
    }

    // Rehydrate authoritative row
    const { data: fullRow, error: selErr } = await pub
      .from('templates')
      .select(TEMPLATE_EDITOR_SELECT)
      .eq('id', id)
      .single();

    if (selErr || !fullRow) {
      const { data: cur2 } = await pub.from('templates').select('data, rev').eq('id', id).single();
      const afterData2 = (cur2 as any)?.data ?? {};
      const hash2 = sha256(afterData2);
      const nextRev2 =
        typeof (cur2 as any)?.rev === 'number'
          ? (cur2 as any).rev
          : Number.isFinite(effectiveBaseRev)
          ? (effectiveBaseRev as number) + 1
          : beforeRev + 1;
      if (DEBUG_ID) dbg('[IDENTITY:API] post-commit select failed; returning fallback', { id, nextRev2, hash2 });
      return j({ id, rev: nextRev2, hash: hash2, kind: kind ?? 'save' });
    }

    const afterData = (fullRow as any)?.data ?? {};
    const nextRev =
      typeof (fullRow as any)?.rev === 'number'
        ? (fullRow as any).rev
        : Number.isFinite(effectiveBaseRev)
        ? (effectiveBaseRev as number) + 1
        : beforeRev + 1;

    const hash = sha256(afterData);

    const normalizedSiteType: string | null =
      (fullRow as any).site_type ??
      (fullRow as any).site_type_key ??
      ((fullRow as any).data?.meta?.site_type ?? null);

    // best-effort event log
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
      if (DEBUG_ID) dbg('[IDENTITY:API] logTemplateEvent failed (ignored)', { error: (e as any)?.message });
    }

    if (DEBUG_ID) {
      dbg('[IDENTITY:API] success', {
        id,
        nextRev,
        site_type: normalizedSiteType,
        meta_identity: afterData?.meta?.identity,
        data_identity: afterData?.identity,
      });
    }

    return j({
      id,
      rev: nextRev,
      hash,
      kind: kind ?? 'save',
      template: { ...(fullRow as any), site_type: normalizedSiteType },
    });
  } catch (e: any) {
    if (DEBUG_ID) dbg('[IDENTITY:API] fatal error', { error: e?.message });
    return j({ error: e?.message || 'commit failed' }, 500);
  }
}
