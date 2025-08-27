// app/api/templates/[id]/snapshots/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const ALLOWED_THEME = new Set(['dark', 'light']);
const ALLOWED_BRAND = new Set(['green', 'blue', 'red']);
const lower = (x: any) => (typeof x === 'string' ? x.toLowerCase() : x);
const num = (v: unknown) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return null;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supa = await getServerSupabase();
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = auth.user.id;

  const body = await req.json().catch(() => ({}));
  const label: string | null = body?.label ?? null;

  // Pull the fields we mirror into snapshots
  const { data: tpl, error: tplErr } = await supa
    .from('templates')
    .select(`
      id, slug, template_name,
      industry, layout, color_scheme,
      data, meta, color_mode,
      theme, brand, is_site,
      header_block, footer_block, services_jsonb,
      contact_email, business_name, address_line1, address_line2, city, state, postal_code,
      latitude, longitude, phone,
      domain, custom_domain,
      logo_url, hero_url, banner_url,
      logo_url_meta, hero_url_meta, banner_url_meta, gallery_meta, team_url,
      published, published_version_id, published_at, published_by
    `)
    .eq('id', id)
    .maybeSingle();

  if (tplErr) return NextResponse.json({ error: tplErr.message }, { status: 400 });
  if (!tpl)   return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // ✔ clamp to pass snapshots_*_check constraints
  const theme = ALLOWED_THEME.has(lower(tpl.theme)) ? lower(tpl.theme) : null;
  const brand = ALLOWED_BRAND.has(lower(tpl.brand)) ? lower(tpl.brand) : null;

  // ✔ ensure array + number sanitization
  const services =
    Array.isArray((tpl as any).services_jsonb) ? (tpl as any).services_jsonb :
    Array.isArray((tpl as any).services)       ? (tpl as any).services       : [];

  const { data: snap, error: insErr } = await supa
    .from('snapshots')
    .insert({
      template_id: id,
      owner_id: userId,

      // labels / metadata
      label,
      commit_message: body?.commit_message ?? null,

      // core mirrors
      template_name: tpl.template_name,
      template_slug: tpl.slug,
      industry: tpl.industry,
      layout: tpl.layout,
      color_scheme: tpl.color_scheme,
      theme,               // ← clamped
      brand,               // ← clamped
      is_site: tpl.is_site ?? false,
      meta: tpl.meta ?? null,
      color_mode: tpl.color_mode ?? null,

      // content
      data: tpl.data ?? null,
      header_block: tpl.header_block ?? null,
      footer_block: tpl.footer_block ?? null,
      services_jsonb: services,

      // identity
      contact_email: tpl.contact_email,
      business_name: tpl.business_name,
      address_line1: tpl.address_line1,
      address_line2: tpl.address_line2,
      city: tpl.city,
      state: tpl.state,
      postal_code: tpl.postal_code,
      latitude: num(tpl.latitude),
      longitude: num(tpl.longitude),
      phone: tpl.phone,

      // branding/media
      domain: tpl.domain,
      custom_domain: tpl.custom_domain,
      logo_url: tpl.logo_url,
      hero_url: tpl.hero_url,
      banner_url: tpl.banner_url,
      logo_url_meta: tpl.logo_url_meta,
      hero_url_meta: tpl.hero_url_meta,
      banner_url_meta: tpl.banner_url_meta,
      gallery_meta: tpl.gallery_meta,
      team_url: tpl.team_url,

      // publish snapshot
      published: tpl.published,
      published_version_id: tpl.published_version_id,
      published_at: tpl.published_at,
      published_by: tpl.published_by,
    })
    .select('id, created_at, label')
    .maybeSingle();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, snapshot: snap });
}
