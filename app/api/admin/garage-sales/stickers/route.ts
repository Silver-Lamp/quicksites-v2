// app/api/admin/garage-sales/stickers/route.ts
//
// Mint a batch of garage-sale sticker codes and return the printable sheet.
//
// Admin-only. A sticker code is a bearer secret — whoever holds it can claim that sale — so
// minting must not be something a visitor can do, and the codes table is deny-default in RLS so
// nobody can enumerate unclaimed ones.
//
// GET  ?batch=<name>  → reprint the sheet for an existing batch (idempotent, mints nothing)
// POST { count, batch } → mint `count` new codes and return the sheet
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mintCodes } from '@/lib/garageSales/codes';
import { renderStickerSheetHtml } from '@/lib/garageSales/stickerSheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 12 per printed sheet; cap a single request at ten sheets so a typo can't mint 10,000. */
const MAX_COUNT = 120;

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'https://www.quicksites.ai'
  ).replace(/\/+$/, '');
}

function html(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  // NOTE: requireAdmin returns `{ user }` OR a NextResponse — a different shape from
  // requireTemplateOwner's `{ ok, response }`. Mixing them up compiles only by accident.
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const batch = req.nextUrl.searchParams.get('batch');
  if (!batch) return NextResponse.json({ error: 'batch is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('garage_sale_stickers')
    .select('code')
    .eq('batch', batch)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: `No stickers in batch "${batch}"` }, { status: 404 });

  return html(await renderStickerSheetHtml({ codes: data.map((r) => r.code), baseUrl: baseUrl(), batch }));
}

export async function POST(req: NextRequest) {
  // NOTE: requireAdmin returns `{ user }` OR a NextResponse — a different shape from
  // requireTemplateOwner's `{ ok, response }`. Mixing them up compiles only by accident.
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json().catch(() => ({}) as any);
  const count = Math.floor(Number(body?.count ?? 12));
  const batch = String(body?.batch ?? '').trim() || null;

  if (!Number.isFinite(count) || count < 1 || count > MAX_COUNT) {
    return NextResponse.json({ error: `count must be between 1 and ${MAX_COUNT}` }, { status: 400 });
  }

  const codes = mintCodes(count);
  const { error } = await supabaseAdmin
    .from('garage_sale_stickers')
    .insert(codes.map((code) => ({ code, batch })));

  // A duplicate would mean a collision against an already-printed sticker, which must never be
  // papered over: two stickers with one code means the second person to scan claims someone
  // else's sale. Fail loudly and let the caller retry into fresh codes.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return html(await renderStickerSheetHtml({ codes, baseUrl: baseUrl(), batch }));
}
