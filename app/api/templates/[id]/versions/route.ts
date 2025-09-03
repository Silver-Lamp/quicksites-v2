// app/api/templates/[id]/versions/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResolveResult = {
  base_slug: string | null;
  canonical_id: string | null;
  trace?: Record<string, unknown>;
};

function pick(...vals: any[]): string | null {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}
function dbg(debug: boolean, ...args: any[]) {
  if (debug) console.log('[QSITES versions]', ...args);
}

/** Accepts canonical id, version id, state id, or base_slug. */
async function resolveViaDb(idOrSlug: string, debug = false): Promise<ResolveResult> {
  const raw = (idOrSlug || '').trim();
  const trace: Record<string, unknown> = { raw };

  if (!raw) return { base_slug: null, canonical_id: null, trace };

  if (UUID_V4.test(raw)) {
    dbg(debug, 'resolveViaDb: UUID path');

    // Try templates by id (covers canonical OR version rows)
    const { data: tplById, error: tplByIdErr } = await supabaseAdmin
      .from('templates')
      .select('id, base_slug, is_version')
      .eq('id', raw)
      .maybeSingle();

    trace.tplByIdErr = tplByIdErr?.message || null;
    trace.tplById = tplById || null;

    if (!tplByIdErr && tplById) {
      // If it's already canonical (is_version is false OR null)
      if (tplById.is_version === false || tplById.is_version == null) {
        return { base_slug: tplById.base_slug, canonical_id: tplById.id, trace };
      }

      // Otherwise find the canonical for this base_slug
      const { data: canon, error: canonErr } = await supabaseAdmin
        .from('templates')
        .select('id, base_slug')
        .eq('base_slug', tplById.base_slug)
        .or('is_version.is.null,is_version.eq.false')
        .maybeSingle();

      trace.canonErr = canonErr?.message || null;
      trace.canon = canon || null;

      if (!canonErr && canon) {
        return { base_slug: canon.base_slug, canonical_id: canon.id, trace };
      }
    }

    // Try template_states (working/state id → canonical)
    try {
      const { data: stateRow, error: stateErr } = await supabaseAdmin
        .from('template_states')
        .select('canonical_id, base_slug')
        .eq('id', raw)
        .maybeSingle();

      trace.stateErr = stateErr?.message || null;
      trace.stateRow = stateRow || null;

      if (!stateErr && stateRow) {
        if (!stateRow.base_slug && stateRow.canonical_id) {
          const { data: canon, error: canonErr } = await supabaseAdmin
            .from('templates')
            .select('id, base_slug')
            .eq('id', stateRow.canonical_id)
            .or('is_version.is.null,is_version.eq.false')
            .maybeSingle();

          trace.stateCanonErr = canonErr?.message || null;
          trace.stateCanon = canon || null;

          if (!canonErr && canon) {
            return { base_slug: canon.base_slug, canonical_id: canon.id, trace };
          }
        }
        return {
          base_slug: stateRow.base_slug ?? null,
          canonical_id: stateRow.canonical_id ?? null,
          trace,
        };
      }
    } catch (e: any) {
      trace.stateCatch = e?.message || String(e);
    }

    return { base_slug: null, canonical_id: null, trace };
  }

  // Non-UUID → treat as base_slug
  dbg(debug, 'resolveViaDb: base_slug path');
  return { base_slug: raw, canonical_id: null, trace };
}

/** Fallback through our own /api/templates/state to tolerate schema drift. */
async function resolveViaStateApi(req: NextRequest, id: string, debug = false): Promise<ResolveResult> {
  try {
    const url = new URL(`/api/templates/state?id=${encodeURIComponent(id)}`, req.nextUrl.origin);
    const r = await fetch(url, {
      headers: { cookie: req.headers.get('cookie') ?? '' }, // forward auth
      cache: 'no-store',
    });
    const j: any = await r.json().catch(() => ({}));
    const canonical_id = pick(
      j?.canonical_id,
      j?.canonicalId,
      j?.template?.canonical_id,
      j?.infra?.template?.canonical_id,
      j?.state?.canonical_id,
      j?.data?.canonical_id
    );
    let base_slug = pick(
      j?.base_slug,
      j?.baseSlug,
      j?.template?.base_slug,
      j?.infra?.template?.base_slug,
      j?.state?.base_slug,
      j?.data?.base_slug
    );

    // If base_slug missing, derive from canonical
    if (!base_slug && canonical_id) {
      const { data: canon, error } = await supabaseAdmin
        .from('templates')
        .select('id, base_slug')
        .eq('id', canonical_id)
        .or('is_version.is.null,is_version.eq.false')
        .maybeSingle();
      if (!error && canon) base_slug = canon.base_slug;
    }

    const trace = { stateStatus: r.status, stateKeys: Object.keys(j || {}) };
    dbg(debug, 'resolveViaStateApi:', { canonical_id, base_slug, trace });

    return { base_slug: base_slug ?? null, canonical_id: canonical_id ?? null, trace };
  } catch (e: any) {
    dbg(debug, 'resolveViaStateApi error:', e?.message || e);
    return { base_slug: null, canonical_id: null, trace: { error: e?.message || String(e) } };
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  // Auth
  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve canonical/base_slug
  let resolved = await resolveViaDb(id, debug);
  if (!resolved.base_slug) {
    const fb = await resolveViaStateApi(req, id, debug);
    resolved = {
      base_slug: resolved.base_slug ?? fb.base_slug,
      canonical_id: resolved.canonical_id ?? fb.canonical_id,
      trace: { db: resolved.trace, state: fb.trace },
    };
  }

  // If still nothing, treat as brand-new (pending) instead of erroring
  if (!resolved.base_slug) {
    dbg(debug, 'resolution pending — no base_slug yet', resolved.trace);
    return NextResponse.json({
      pending: true,
      canonical_id: resolved.canonical_id ?? null,
      base_slug: null,
      versions: [],
      published_version_id: null,
      trace: debug ? resolved.trace : undefined,
    });
  }

  // Confirm canonical row (handle is_version NULL/false)
  const { data: canonical, error: cErr } = await supabaseAdmin
    .from('templates')
    .select('id, owner_id, published_version_id, is_version, base_slug')
    .eq('base_slug', resolved.base_slug)
    .or('is_version.is.null,is_version.eq.false')
    .maybeSingle();

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 400 });
  }

  // If canonical doesn’t exist yet, also return "pending"
  if (!canonical) {
    dbg(debug, 'canonical not created yet — pending', { base_slug: resolved.base_slug });
    return NextResponse.json({
      pending: true,
      canonical_id: null,
      base_slug: resolved.base_slug,
      versions: [],
      published_version_id: null,
      trace: debug ? resolved.trace : undefined,
    });
  }

  // Versions (newest first)
  const { data: versions, error: vErr } = await supabaseAdmin
    .from('templates')
    .select('id, slug, commit, created_at, updated_at')
    .eq('base_slug', resolved.base_slug)
    .eq('is_version', true)
    .order('updated_at', { ascending: false });

  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 400 });
  }

  const payload: any = {
    canonical_id: canonical.id,
    base_slug: resolved.base_slug,
    versions: versions ?? [],
    published_version_id: canonical.published_version_id ?? null,
  };
  if (debug) payload.trace = resolved.trace;

  return NextResponse.json(payload);
}
