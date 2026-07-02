// app/api/templates/duplicate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireUser';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const slugify = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const baseSlug = (s: string) => slugify(s).replace(/(-copy-\w+)+$/i, '');

async function uniqueSlugCandidate(base: string, bump: number) {
  const candidate = bump === 0 ? base : `${base}-${bump + 1}`;
  // optional cheap existence check (not strictly needed since RPC will 409 on conflict)
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('id')
    .eq('slug', candidate)
    .maybeSingle();
  if (!data && !error) return candidate;
  return null;
}

async function trySetSlugViaCommit(templateId: string, desired: string) {
  const root = slugify(desired) || 'untitled';
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const r = await supabaseAdmin
      .schema('app')
      .rpc('set_template_slug', { p_id: templateId, p_slug: candidate });

    if (!r.error) {
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      return { ok: true as const, slug: (row?.slug as string) ?? candidate };
    }

    const code = String(r.error.code || '').toUpperCase();
    const msg = r.error.message || '';

    // Published/base locked
    if (code === 'P0001' && /publish/i.test(msg)) {
      return { ok: false as const, status: 409, error: 'Unpublish the base template to change the slug.' };
    }

    // Uniqueness conflicts → next candidate
    if (code === '23505' || /slug.*taken|domain.*conflict/i.test(msg)) {
      continue;
    }

    // Unknown error → stop
    return { ok: false as const, status: 500, error: msg || 'Slug update failed.' };
  }
  return { ok: false as const, status: 409, error: 'Could not allocate a unique slug.' };
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    // Require a signed-in user: the duplicate is written with the service-role
    // client below (bypassing RLS), so without this gate anyone could mint
    // orphan templates from any readable source. The new row is owned by them.
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const srcSlug = url.searchParams.get('slug');
    if (!srcSlug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    // 1) Load source by slug
    const { data: src, error: loadErr } = await supabase
      .from('templates')
      .select('*')
      .eq('slug', srcSlug)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!src) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // 2) Build name and desired new slug
    const base = baseSlug(src.slug || src.template_name || 'copy');
    const displaySuffix = Math.random().toString(36).slice(-4);
    const newName = `${src.template_name ?? base} (copy ${displaySuffix})`;
    const desiredSlug = `${base}-copy-${displaySuffix}`;

    // 3) Copy JSON safely
    // src.data is Json — spread requires object cast (Pattern F)
    const dataObj: any = { ...(src.data as Record<string, any> ?? {}) };
    if (!dataObj.pages && Array.isArray((src as any).pages)) dataObj.pages = (src as any).pages;
    dataObj.archived = false;
    delete (dataObj as any).custom_domain;

    // 4) Insert the duplicate WITHOUT slug (guard-friendly)
    const insertRow: any = {
      template_name: newName,
      // slug: (set via RPC below)
      owner_id: user.id,
      is_site: src.is_site ?? false,
      published: false,
      archived: false,
      data: dataObj,

      layout: src.layout ?? null,
      color_scheme: src.color_scheme ?? null,
      theme: src.theme ?? null,
      brand: src.brand ?? null,
      industry: src.industry ?? null,
      phone: src.phone ?? null,

      hero_url: src.hero_url ?? null,
      banner_url: src.banner_url ?? null,
      logo_url: src.logo_url ?? null,
      team_url: src.team_url ?? null,

      site_id: null,
      commit: null,
      domain: null,
      custom_domain: null,
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('templates')
      .insert(insertRow)
      .select('id')
      .single();

    if (insErr || !inserted?.id) {
      return NextResponse.json(
        { error: insErr?.message || 'Insert failed', details: insErr?.details, code: insErr?.code },
        { status: 500 }
      );
    }

    const newId = inserted.id as string;

    // 5) Set slug via commit pipeline RPC
    const set = await trySetSlugViaCommit(newId, desiredSlug);
    if (!set.ok) {
      return NextResponse.json(
        { error: set.error, template_id: newId, code: set.status },
        { status: set.status ?? 500 }
      );
    }

    // 6) Done
    return NextResponse.json({
      ok: true,
      id: newId,
      template_name: newName,
      slug: set.slug,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
