// app/api/lemonade/print/[slug]/route.ts
//
// The printables for one stand, as a print-ready HTML document.
//
// ⚠️ `renderStandSignHtml` HAS EXISTED SINCE THE VERTICAL SHIPPED AND NOTHING SERVED IT. A
// stand's whole problem is a customer standing in the driveway with no cash, which the website
// cannot solve on its own — the physical sign is the product. It was written, tested, and
// reachable by nobody. Three separate things in this repo turned out that way today; the pattern
// is that a lib with no route looks finished from the inside.
//
// HTML rather than PDF on purpose: the browser's own print dialog handles page sizing, and the
// QR codes are baked in as data URLs, so this prints correctly from a phone, a Chromebook, or a
// library computer with no network — which is a realistic description of where a parent will
// actually do this.
//
// Public by design. Everything on the page is already public: the stand's name, its menu, and a
// QR pointing at its own front page. Requiring a login to print your own sign would be a gate in
// front of the one step that makes the site useful, and it protects nothing.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { renderStandSignHtml, standUrlFor } from '@/lib/lemonade/standSign';
import { readMenuSections } from '@/lib/menu/menuBlocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('slug, custom_domain, template_name, business_name, data')
    .eq('slug', slug)
    .maybeSingle();

  if (!tpl) return NextResponse.json({ error: 'No stand at that address.' }, { status: 404 });

  const row = tpl as any;
  const standUrl = standUrlFor(row);
  if (!standUrl) {
    // No slug and no domain means no address to encode. A QR pointing nowhere is worse than the
    // absence of one: it prints, it scans, and it fails in front of a customer.
    return NextResponse.json({ error: 'This stand has no public address yet.' }, { status: 409 });
  }

  const meta = row.data?.meta ?? {};
  const standName =
    (row.business_name || '').trim() ||
    (meta.siteTitle || '').trim() ||
    (row.template_name || '').trim() ||
    'The Lemonade Stand';

  // The cause line is the part customers actually read, and the reason some of them round up —
  // so it belongs on the printed board, not only on the page.
  const cause =
    (meta.cause || meta.saving_for || row.data?.meta?.story?.cause || '').toString().trim() || null;

  // Read through menuBlocks, which knows about BOTH block shapes. Reaching into
  // content.sections directly would print an empty board for any stand whose menu lives under
  // `props` — see the header of lib/menu/menuBlocks.ts.
  const sections = readMenuSections(row.data).map((s: any) => ({
    name: String(s?.name ?? ''),
    items: (s?.items ?? []).map((i: any) => ({ name: String(i?.name ?? ''), price: i?.price ?? null })),
  }));

  const html = await renderStandSignHtml({ standUrl, standName, cause, menu: sections });

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short cache: a parent who fixes a price and reprints should get the new board, but a
      // sheet of QR codes is expensive enough to render that a burst of reloads shouldn't
      // regenerate it each time.
      'cache-control': 'public, max-age=60',
    },
  });
}
