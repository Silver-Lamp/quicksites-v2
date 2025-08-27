export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

/* helpers */
const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';
function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}
function stripHFPage(page: any) {
  const canon = Array.isArray(page?.blocks) ? page.blocks : [];
  const legacy = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  const blocks = (canon.length ? canon : legacy).filter((b: any) => !isHeader(b) && !isFooter(b));
  return { ...page, blocks, content_blocks: blocks };
}
function normalizeForSave(input: any) {
  const tpl = JSON.parse(JSON.stringify(input ?? {}));
  const pagesIn = getPages(tpl);

  let headerBlock = tpl.headerBlock ?? tpl?.data?.headerBlock ?? null;
  let footerBlock = tpl.footerBlock ?? tpl?.data?.footerBlock ?? null;

  if ((!headerBlock || !footerBlock) && pagesIn.length > 0) {
    const firstBlocks = (Array.isArray(pagesIn[0]?.blocks) ? pagesIn[0].blocks : pagesIn[0]?.content_blocks) || [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  const cleanedPages = pagesIn.map(stripHFPage);
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  const effColor =
    tpl?.color_mode && (tpl.color_mode === 'light' || tpl.color_mode === 'dark')
      ? tpl.color_mode
      : (tpl?.data?.color_mode === 'light' || tpl?.data?.color_mode === 'dark')
      ? tpl.data.color_mode
      : null;

  return { tpl, headerBlock: headerBlock ?? null, footerBlock: footerBlock ?? null, colorMode: effColor };
}
function safeSlug(s: string | undefined | null) {
  const base = (s ?? '').toString().toLowerCase().trim();
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || `template-${Math.random().toString(36).slice(2, 6)}`;
}
// numeric sanitizer: '' → null, '43.1' → 43.1
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
  const { data: authData, error: authErr } = await supa.auth.getUser();
  if (authErr || !authData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authData.user.id;

  const body = (await req.json().catch(() => null)) as { template?: any } | null;
  if (!body?.template) return NextResponse.json({ error: 'Missing template' }, { status: 400 });

  const { tpl, headerBlock, footerBlock, colorMode } = normalizeForSave(body.template);

  const now = new Date().toISOString();
  const update: any = {
    data: tpl.data ?? null,
    header_block: headerBlock,
    footer_block: footerBlock,
    color_mode: colorMode ?? tpl.color_mode ?? null,
    updated_at: now,
    hours: tpl.hours ?? null,
  };

  const idCols = [
    'business_name','contact_email','phone',
    'address_line1','address_line2','city','state','postal_code',
    'latitude','longitude','industry',
    'brand','theme','layout','color_scheme',
    'published','verified','hours',
  ];
  for (const k of idCols) if (k in tpl && tpl[k] !== undefined) update[k] = tpl[k];

  // sanitize numeric columns to avoid "" → double precision error
  update.latitude  = num((tpl as any).latitude);
  update.longitude = num((tpl as any).longitude);

  // array-safe services
  if (Array.isArray(tpl?.services_jsonb)) update.services_jsonb = tpl.services_jsonb;
  else if (Array.isArray(tpl?.services))  update.services_jsonb = tpl.services;
  else if (update.services_jsonb === undefined) update.services_jsonb = [];

  // Try update first
  const { data: upd, error: updErr } = await supabaseAdmin
    .from('templates')
    .update(update)
    .eq('id', id)
    .select('id, slug, template_name, color_mode, updated_at')
    .maybeSingle();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  if (upd)   return NextResponse.json({ ok: true, template: upd });

  // Not found → create (with owner_id)
  const baseName = (tpl.template_name as string) || (tpl.slug as string) || 'untitled';
  const insertable = {
    id,
    owner_id: (tpl as any).owner_id || userId,
    template_name: baseName,
    slug: safeSlug(tpl.slug || baseName),
    verified: false,
    created_at: tpl.created_at || now,
    updated_at: now,
    hours: tpl.hours ?? null,
    ...update,
  };

  const { data: ins, error: insErr } = await supabaseAdmin
    .from('templates')
    .upsert(insertable, { onConflict: 'id' })
    .select('id, slug, template_name, color_mode, updated_at')
    .maybeSingle();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, template: ins ?? insertable });
}
