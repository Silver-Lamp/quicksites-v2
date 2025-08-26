// app/api/templates/[id]/snapshots/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// strip any random suffix (e.g., "-px8h") to derive the base slug
function baseSlug(slug?: string | null) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}
function isHeader(b: any) { return b?.type === 'header'; }
function isFooter(b: any) { return b?.type === 'footer'; }
function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}
function stripHFPage(page: any) {
  const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  return { ...page, content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)) };
}

// Normalize minimally like the client does before snapshotting.
function normalizeForSnapshotServer(t: any) {
  const tpl = JSON.parse(JSON.stringify(t ?? {}));
  const pagesIn = getPages(tpl);

  let headerBlock =
    tpl.headerBlock ?? tpl?.data?.headerBlock ?? null;
  let footerBlock =
    tpl.footerBlock ?? tpl?.data?.footerBlock ?? null;

  if ((!headerBlock || !footerBlock) && pagesIn.length > 0) {
    const firstBlocks = Array.isArray(pagesIn[0]?.content_blocks)
      ? pagesIn[0].content_blocks
      : [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  const cleanedPages = pagesIn.map(stripHFPage);

  // Preserve color mode (prefer top; fallback to nested)
  const effColor =
    tpl?.color_mode && (tpl.color_mode === 'light' || tpl.color_mode === 'dark')
      ? tpl.color_mode
      : (tpl?.data?.color_mode === 'light' || tpl?.data?.color_mode === 'dark')
      ? tpl.data.color_mode
      : null;

  // Ensure pages exist both places
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  return {
    tpl,
    headerBlock: headerBlock ?? null,
    footerBlock: footerBlock ?? null,
    colorMode: effColor,
  };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // must be logged in
  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // parse body
  const body = await req.json().catch(() => null) as { template?: any; commit?: string } | null;
  if (!body?.template) return NextResponse.json({ error: 'Missing template' }, { status: 400 });
  const commit = String(body.commit ?? 'Snapshot').slice(0, 140);
  const t = body.template;

  // Resolve base_slug:
  //  - if UUID → look up canonical base_slug
  //  - else → treat param as slug-like and normalize to baseSlug()
  let base_slug = id;
  if (UUID_V4.test(id)) {
    const { data: row, error } = await supabaseAdmin
      .from('templates')
      .select('base_slug')
      .eq('id', id)
      .maybeSingle();
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    base_slug = row.base_slug;
  } else {
    base_slug = baseSlug(id);
  }

  // Optional: authorization check could go here (owner_id, org_id, etc.)

  // Normalize incoming template
  const { tpl, headerBlock, footerBlock, colorMode } = normalizeForSnapshotServer(t);

  // Build version row
  const row: any = {
    is_version: true,
    archived: false,
    base_slug,
    slug: null, // anonymous for versions
    template_name: tpl.template_name ?? t.template_name ?? null,
    data: tpl.data ?? null,
    header_block: headerBlock,
    footer_block: footerBlock,
    color_mode: colorMode ?? tpl.color_mode ?? null,
    commit,
    meta: tpl.meta ?? null
  };

  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert(row)
    .select('id, slug, base_slug, commit, created_at, updated_at, is_version')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ version: data });
}
