// app/api/templates/duplicate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Match your UI's baseSlug() behavior (only used for display suffix)
function baseSlug(slug: string) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}

// Use a 13+ char token so your baseSlug() **won't** strip it.
// That makes DB-computed base_slug === slug (so is_version becomes false).
function longToken(len = 13) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const buf = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

async function uniqueSlug(supabase: any, base: string) {
  for (let i = 0; i < 50; i++) {
    const candidate = `${base}-${longToken(13)}`; // single long segment
    const { data, error } = await supabase
      .from('templates')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  throw new Error('Could not generate a unique slug; please try again.');
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    // 1) Load source by slug
    const { data: src, error: loadErr } = await supabase
      .from('templates')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!src) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // 2) Build new slug + display name
    const base = baseSlug(src.slug || src.template_name || 'copy');
    const newSlug = await uniqueSlug(supabase, base);
    const displaySuffix = newSlug.slice(-4);
    const newName = `${src.template_name ?? base} (copy ${displaySuffix})`;

    // 3) Copy JSON safely
    const dataObj: any = { ...(src.data ?? {}) };
    if (!dataObj.pages && Array.isArray((src as any).pages)) dataObj.pages = (src as any).pages;
    dataObj.archived = false;
    delete (dataObj as any).custom_domain;

    // 4) Insert — DO NOT set base_slug or is_version (DB computes them)
    const insertRow: any = {
      template_name: newName,
      slug: newSlug,
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

    const { data: inserted, error: insErr } = await supabase
      .from('templates')
      .insert(insertRow)
      .select('id, slug')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: inserted.id, slug: inserted.slug });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
