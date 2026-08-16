// app/api/templates/commit/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { diffBlocks } from '@/lib/diff/blocks';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';
import { stripEmpty, obj, dget, ddel, enrichPatchWithIdentity } from '@/lib/templates/identity';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { mergeTemplateMeta } from '@/lib/templates/mergeMeta';
import { persistReadinessScore } from '@/lib/seo/persistReadiness';

// optional org (keeps single-tenant working)
let resolveOrg: undefined | (() => Promise<any>);
try { resolveOrg = require('@/lib/org/resolveOrg').resolveOrg; } catch {}

/* ───────────────────────────── helpers ───────────────────────────── */

type Kind = 'save' | 'autosave';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const FORBIDDEN_COLS = new Set([
  'slug',               // <- never let commit change slug
  'base_slug','is_version','rev','updated_at','created_at','owner_id','published_version_id',
]);

const DEBUG_ID = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG_ID) console.log(...args); };


/** Projection for rehydrate. */
const TEMPLATE_EDITOR_SELECT = [
  'id','slug','base_slug','rev','updated_at',
  'template_name','business_name','industry','industry_label',
  'site_type','site_type_key','site_type_label',
  'contact_email','phone','address_line1','address_line2','city','state','postal_code',
  'latitude','longitude','color_mode','color_scheme','layout','data',
  'company_id',
].join(', ');

/* ──────────────── RPC helpers ──────────────── */

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

async function tryAllRpcs(id: string, payload: any): Promise<RpcResult> {
  // 1) public.commit_template_http(p_payload)
  let r = await callRpc('public','commit_template_http', { p_payload: payload });
  if (r.ok) return r;

  // 2) app.commit_template(p_payload jsonb)
  r = await callRpc('app','commit_template', { p_payload: payload });
  if (r.ok) return r;

  // 3) app.commit_template(p_id,p_base_rev,p_patch,p_actor)
  r = await callRpc('app','commit_template', { p_id: id, p_base_rev: payload.base_rev, p_patch: payload.patch, p_actor: payload.actor ?? null });
  if (r.ok) return r;

  // 4) app.commit_template(..., p_kind)
  r = await callRpc('app','commit_template', { p_id: id, p_base_rev: payload.base_rev, p_patch: payload.patch, p_actor: payload.actor ?? null, p_kind: payload.kind ?? 'save' });
  if (r.ok) return r;

  // 5) public.commit_template_patch(p_id,p_base_rev,p_patch,p_actor,p_kind)
  r = await callRpc('public','commit_template_patch', { p_id: id, p_base_rev: payload.base_rev, p_patch: payload.patch, p_actor: payload.actor ?? null, p_kind: payload.kind ?? 'save' });
  if (r.ok) return r;

  // 6) legacy public.commit_template(template_id,patch,actor_id,reason)
  r = await callRpc('public','commit_template', { template_id: id, patch: payload.patch, actor_id: payload.actor ?? null, reason: 'editor save' });
  return r;
}

/* ───────────────────── Company linkage & hours redirect helpers ───────────────────── */

function resolveIncomingCompanyIdFromPatch(patch: any): string | null {
  const d = obj(patch?.data);
  return (d?.company_id && typeof d.company_id === 'string' && d.company_id) || null;
}

function resolveCompanyId(beforeRow: any, patch: any): string | null {
  // Prefer explicit incoming; else column; else legacy JSON
  return (
    resolveIncomingCompanyIdFromPatch(patch) ||
    (beforeRow?.company_id ?? null) ||
    (beforeRow?.data?.company_id ?? null)
  );
}

async function ensureTemplateCompanyColumn(pub: any, templateId: string, nextCompanyId: string | null) {
  if (!nextCompanyId) return;
  await pub.from('templates').update({ company_id: nextCompanyId }).eq('id', templateId);
}

async function upsertCompanyHours(pub: any, companyId: string, hours: any) {
  const { error } = await pub
    .from('companies')
    .update({ business_hours: hours })
    .eq('id', companyId)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
}

async function fetchCompanyHours(pub: any, companyId: string): Promise<any | null> {
  const { data, error } = await pub
    .from('companies')
    .select('business_hours')
    .eq('id', companyId)
    .single();
  if (error) return null;
  return (data as { business_hours: any } | null)?.business_hours ?? null;
}

/* ──────────────── Types used for local narrowing (no generics on .select) ─────────────── */

type BeforeRow = {
  rev: number | null;
  data: any;
  company_id: string | null;
  owner_id: string | null;
};

type TemplateRowForEditor = {
  id: string;
  rev: number | null;
  data: any;
  company_id: string | null;
  site_type?: string | null;
  site_type_key?: string | null;
  site_type_label?: string | null;
  template_name?: string | null;
  business_name?: string | null;
  industry?: string | null;
  industry_label?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  color_mode?: string | null;
  color_scheme?: string | null;
  layout?: string | null;
  slug?: string | null;
  base_slug?: string | null;
  updated_at?: string | null;
};

/* ────────────────────────────────── ROUTE ────────────────────────────────── */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, baseRev, patch: rawPatch, kind } = body as {
      id: string; baseRev?: number; patch: Record<string, any>; kind?: Kind;
    };

    if (!id || typeof id !== 'string') return j({ error: 'id required' }, 400);
    if (!rawPatch || typeof rawPatch !== 'object') return j({ error: 'patch required (object)' }, 400);

    // AuthZ: the caller must own this template (an anonymous guest who owns their
    // draft is allowed — editing is open to guests; only publishing needs sign-up)
    // or be a platform admin. Without this, anyone could commit edits to ANY
    // template via the service-role RPC.
    const gate = await requireTemplateOwner(id);
    if (!gate.ok) return gate.response;

    // forbid slug updates here
    for (const k of Object.keys(rawPatch)) {
      if (k === 'slug' || k === 'base_slug' || k === 'is_version' || k === 'rev' || k === 'updated_at' || k === 'created_at' || k === 'owner_id' || k === 'published_version_id') {
        delete (rawPatch as any)[k];
      }
    }
    // also drop stray nested 'slug'
    if (rawPatch.data) {
      try {
        const d = typeof rawPatch.data === 'object' ? rawPatch.data : JSON.parse(String(rawPatch.data));
        if (d && typeof d === 'object') {
          if ('slug' in d) delete (d as any).slug;
          if (d.meta && typeof d.meta === 'object' && 'slug' in d.meta) delete (d.meta as any).slug;
          rawPatch.data = d;
        }
      } catch {}
    }

    const pub = supabaseAdmin.schema('public');

    // before state (no generics; cast once)
    const beforeRes = await pub
      .from('templates')
      .select('rev,data,company_id,owner_id')
      .eq('id', id)
      .single();

    const beforeErr = beforeRes.error;
    const beforeRow = beforeRes.data as BeforeRow | null;

    if (beforeErr || !beforeRow) return j({ error: beforeErr?.message || 'template not found' }, 404);

    const beforeRev = typeof beforeRow.rev === 'number' ? beforeRow.rev : 0;
    const beforeData = beforeRow.data ?? {};
    const effectiveBaseRev = Number.isFinite(baseRev as number) ? (baseRev as number) : beforeRev;

    // optional org
    let orgId: string | undefined;
    try { if (resolveOrg) { const org = await resolveOrg(); if (org?.id) orgId = String(org.id); } } catch {}

    // enrich patch + strip empties
    if (DEBUG_ID) dbg('[IDENTITY:API] incoming patch', { id, baseRev: effectiveBaseRev, patch: rawPatch });
    const enrichedPatch = enrichPatchWithIdentity(rawPatch, beforeData);

    // ── Promote company_id to column (from JSON) ─────────────────────────────
    const incomingCompanyId = resolveIncomingCompanyIdFromPatch(enrichedPatch);
    const resolvedCompanyId = resolveCompanyId(beforeRow, enrichedPatch);

    if (incomingCompanyId && incomingCompanyId !== beforeRow.company_id) {
      await ensureTemplateCompanyColumn(pub, id, incomingCompanyId);
    }

    // Always strip legacy JSON copy to prevent future drift
    ddel(enrichedPatch, ['data', 'company_id']);

    // ── Redirect hours writes to companies.business_hours (when company present) ─────
    const incomingHours = dget(enrichedPatch, ['data','meta','hours']);
    if (resolvedCompanyId && incomingHours && typeof incomingHours === 'object') {
      try {
        await upsertCompanyHours(pub, resolvedCompanyId, incomingHours);
        // strip from template patch so we don't store two sources of truth
        ddel(enrichedPatch, ['data','meta','hours']);
        if (DEBUG_ID) dbg('[IDENTITY:API] redirected hours → companies.business_hours', { companyId: resolvedCompanyId });
      } catch (e: any) {
        // If company write fails, we *do not* drop the template hours (keep user data safe)
        if (DEBUG_ID) dbg('[IDENTITY:API] company hours write failed; leaving hours in template patch', { error: e?.message });
      }
    }

    /**
     * ⚠️ MERGE `data.meta`, NEVER REPLACE IT — the editor's copy is not authoritative.
     *
     * The editor sends the whole `data` blob from its in-memory template, so `data.meta`
     * arrives as a complete object and overwrites the stored one. Any key the browser's copy
     * did not happen to contain is therefore DELETED, with no edit to that key and nothing on
     * screen about it.
     *
     * Observed on renton-lemonade-fxny within one hour, twice:
     *   • `meta.ecom.merchant_id`, written server-side through the sanctioned commit RPC, was
     *     gone after the next settings save — taking the site's link to the merchant that can
     *     actually charge a card, while the menu kept its "Add to order" buttons because those
     *     live under `pages`. A store that looks open and has no till.
     *   • A Venmo handle saved in the settings panel rendered in the preview and never reached
     *     the row at all, because the toolbar serialised a `meta` captured before the patch.
     *
     * Both are the same shape: a last-writer-wins whole-object write racing an out-of-band one.
     * Merging makes the loss impossible rather than unlikely — a save can only change the keys
     * it actually carries. Deleting a meta key now needs an explicit `null`, which is the right
     * trade: silent deletion is not a feature anyone asked for, and every real deletion here
     * (clearing a Venmo handle, unsetting a merchant) is a deliberate act that can say so.
     */
    const incomingMeta = dget(enrichedPatch, ['data', 'meta']);
    if (incomingMeta && typeof incomingMeta === 'object' && !Array.isArray(incomingMeta)) {
      (enrichedPatch as any).data.meta = mergeTemplateMeta((beforeData as any)?.meta, incomingMeta);
    }

    const strippedPatch = stripEmpty(enrichedPatch ?? {});

    const payload = {
      id,
      base_rev: effectiveBaseRev,
      patch: strippedPatch,
      actor: null,
      kind: (kind ?? 'save') as Kind,
      org_id: orgId ?? null,
    };

    // ── First RPC attempt ──
    const r = await tryAllRpcs(id, payload);

    if (!r.ok) {
      // refresh current rev
      const curRes = await pub.from('templates').select('rev').eq('id', id).maybeSingle();
      const currentRev = (curRes.data as { rev: number | null } | null)?.rev ?? beforeRev;

      const revMismatch = currentRev !== payload.base_rev;
      const conflictish = looksLikeConflict((r as any).error);

      if (revMismatch || conflictish) {
        // ── Server-side single rebase retry ──
        const retryPayload = { ...payload, base_rev: currentRev };
        const retry = await tryAllRpcs(id, retryPayload);

        if (!retry.ok) {
          // still conflicting → hand a client-retry payload
          return j({
            conflict: true,
            error: 'merge_conflict',
            rev: currentRev,
            latest: { id, baseRev: currentRev, patch: strippedPatch, kind: kind ?? 'save' },
          }, 409);
        }
        // else fall-through → success path
      } else {
        // Not rebaseable → guard/exposure/etc.
        return j({
          error: 'guard_blocked',
          message:
            'Direct updates are blocked or RPC is not exposed. Expose one of: public.commit_template_http(p_payload), app.commit_template(p_payload) or compatible commit_template(...).',
          detail: String((r as any).error?.message || (r as any).error),
        }, 409);
      }
    }

    // Funnel: the first successful commit on a fresh template (rev 0 → 1) is the
    // "builder activated" signal. Fire once, best-effort; keyed to the owner so it
    // stitches to their signup. (docs/MODEL_A_PLAN.md A7)
    if (beforeRev === 0) {
      try {
        await captureServer(
          EVENTS.BUILDER_ACTIVATED,
          { template_id: id, org_id: orgId ?? null, kind: kind ?? 'save' },
          beforeRow.owner_id ?? undefined
        );
      } catch {}
    }

    // Rehydrate authoritative row (no generics; cast once)
    const fullRes = await pub
      .from('templates')
      .select(TEMPLATE_EDITOR_SELECT)
      .eq('id', id)
      .single();

    const selErr = fullRes.error;
    const fullRow = fullRes.data as TemplateRowForEditor | null;

    if (selErr || !fullRow) {
      const cur2 = await pub
        .from('templates')
        .select('data, rev')
        .eq('id', id)
        .single();
      const cur2Data = cur2.data as { data: any; rev: number | null } | null;
      const afterData2 = cur2Data?.data ?? {};
      const hash2 = sha256(afterData2);
      const nextRev2 =
        typeof cur2Data?.rev === 'number'
          ? cur2Data.rev
          : Number.isFinite(effectiveBaseRev)
          ? (effectiveBaseRev as number) + 1
          : beforeRev + 1;
      if (DEBUG_ID) dbg('[IDENTITY:API] post-commit select failed; returning fallback', { id, nextRev2, hash2 });
      return j({ id, rev: nextRev2, hash: hash2, kind: kind ?? 'save' });
    }

    // If we have a company id (column wins; else fallback), inject company hours into the response payload
    const finalCompanyId: string | null =
      fullRow.company_id ??
      resolvedCompanyId ??
      (fullRow.data as any)?.company_id ??
      null;

    let afterData = fullRow.data ?? {};
    if (finalCompanyId) {
      const companyHours = await fetchCompanyHours(pub, finalCompanyId);
      if (companyHours) {
        afterData = {
          ...afterData,
          meta: {
            ...(afterData?.meta ?? {}),
            hours: companyHours, // inject for compatibility so existing renderers keep working
          },
        };
      }
    }

    const nextRev =
      typeof fullRow.rev === 'number'
        ? fullRow.rev
        : Number.isFinite(effectiveBaseRev)
        ? (effectiveBaseRev as number) + 1
        : beforeRev + 1;

    const hash = sha256(afterData);

    const normalizedSiteType: string | null =
      (fullRow as any).site_type ??
      (fullRow as any).site_type_key ??
      ((afterData as any)?.meta?.site_type ?? null);

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
        company_id: finalCompanyId,
      });
    }

    // Refresh the persisted SEO-readiness score so the templates list stays sortable
    // by it. Fire-and-forget — never block or fail the commit on scoring.
    void persistReadinessScore(id, afterData, (fullRow as any).industry, (fullRow as any).slug);

    // Return the template row + injected hours (compat), and surface company_id
    const templateOut = { ...(fullRow as any), data: afterData, site_type: normalizedSiteType };
    if (!templateOut.company_id && finalCompanyId) templateOut.company_id = finalCompanyId;

    return j({
      id,
      rev: nextRev,
      hash,
      kind: kind ?? 'save',
      template: templateOut,
    });
  } catch (e: any) {
    if (DEBUG_ID) dbg('[IDENTITY:API] fatal error', { error: e?.message });
    return j({ error: e?.message || 'commit failed' }, 500);
  }
}
