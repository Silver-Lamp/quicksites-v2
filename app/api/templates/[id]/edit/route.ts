export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

/* ---------------- helpers ---------------- */

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
  const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  return { ...page, content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)) };
}

/** Normalize like the client snapshot does:
 *  - hoist header/footer to root
 *  - strip header/footer from page content
 *  - sync pages both at root and under data.pages
 *  - derive effective color_mode
 */
function normalizeForSave(input: any) {
  const tpl = JSON.parse(JSON.stringify(input ?? {}));
  const pagesIn = getPages(tpl);

  let headerBlock = tpl.headerBlock ?? tpl?.data?.headerBlock ?? null;
  let footerBlock = tpl.footerBlock ?? tpl?.data?.footerBlock ?? null;

  if ((!headerBlock || !footerBlock) && pagesIn.length > 0) {
    const firstBlocks = Array.isArray(pagesIn[0]?.content_blocks) ? pagesIn[0].content_blocks : [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  const cleanedPages = pagesIn.map(stripHFPage);

  // ensure pages present in both places
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  // effective color mode (top wins)
  const effColor =
    tpl?.color_mode && (tpl.color_mode === 'light' || tpl.color_mode === 'dark')
      ? tpl.color_mode
      : (tpl?.data?.color_mode === 'light' || tpl?.data?.color_mode === 'dark')
      ? tpl.data.color_mode
      : null;

  return { tpl, headerBlock: headerBlock ?? null, footerBlock: footerBlock ?? null, colorMode: effColor };
}

/* ---------------- route ---------------- */

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // server-side auth
  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { template?: any } | null;
  if (!body?.template) return NextResponse.json({ error: 'Missing template' }, { status: 400 });

  const incoming = body.template;

  // Normalize payload (pages/header/footer/color)
  const { tpl, headerBlock, footerBlock, colorMode } = normalizeForSave(incoming);

  // Build update payload:
  const update: any = {
    data: tpl.data ?? null,                   // includes data.pages
    header_block: headerBlock,
    footer_block: footerBlock,
    color_mode: colorMode ?? tpl.color_mode ?? null,
  };

  // 🔒 NEVER rename here; ignore slug/template_name in this endpoint

  // Identity / business columns (only copy if present)
  const idCols = [
    'business_name', 'contact_email', 'phone',
    'address_line1', 'address_line2', 'city', 'state', 'postal_code',
    'latitude', 'longitude', 'industry',
    // optional look&feel columns if you store them at top level:
    'brand', 'theme', 'layout', 'color_scheme',
  ];
  for (const k of idCols) {
    if (k in tpl && tpl[k] !== undefined) update[k] = tpl[k];
  }

  // services → services_jsonb
  if (Array.isArray(tpl?.services_jsonb)) {
    update.services_jsonb = tpl.services_jsonb;
  } else if (Array.isArray(tpl?.services)) {
    update.services_jsonb = tpl.services;
  }

  // optional: meta (favicon etc.) – uncomment if you have a meta column
  // if (tpl?.meta && typeof tpl.meta === 'object') {
  //   update.meta = tpl.meta;
  // }

  const { data, error } = await supabaseAdmin
    .from('templates')
    .update(update)
    .eq('id', id)
    .select('id, slug, template_name, color_mode, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, template: data });
}
