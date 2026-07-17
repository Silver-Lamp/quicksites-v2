// app/api/templates/[id]/listing-qr-pack/route.ts
//
// Printable yard-sign QR pack for a listing_card block (crosstalk ideas.md §4).
// Owner-or-admin gated. Finds the listing card (?block=<_id>, else the first one),
// requires a VALID About That embed id (the listen page 403s renders for hosts not
// on the embed's allowed_domains — no point printing a dead QR), computes the
// listing page's public URL, and returns the self-contained printable HTML.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { renderListingQrPackHtml, EMBED_UUID_RX } from '@/lib/listings/qrPack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireTemplateOwner(id);
  if (!gate.ok) return gate.response;

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, slug, data, business_name, template_name, custom_domain')
    .eq('id', id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

  const blockId = new URL(req.url).searchParams.get('block') || '';
  const pages: any[] = Array.isArray((t as any).data?.pages) ? (t as any).data.pages : [];

  let card: any = null;
  let pageSlug = '';
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks) ? p.blocks : Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    const hit = blocks.find(
      (b: any) => b?.type === 'listing_card' && (!blockId || (b?._id ?? b?.id) === blockId),
    );
    if (hit) {
      card = hit;
      pageSlug = typeof p?.slug === 'string' ? p.slug : '';
      break;
    }
  }
  if (!card) return NextResponse.json({ error: 'No listing card found on this site.' }, { status: 404 });

  const c: any = card.content ?? {};
  const embedId = typeof c.about_that_embed_id === 'string' ? c.about_that_embed_id.trim() : '';
  if (!EMBED_UUID_RX.test(embedId)) {
    return NextResponse.json(
      { error: 'This listing has no About That player yet — set the embed ID on the listing card first.' },
      { status: 400 },
    );
  }

  // The listing page's public URL. Custom domain when attached (its host must be on
  // the embed's allowed_domains); otherwise the platform path (quicksites.ai host).
  const base = (t as any).custom_domain
    ? `https://${(t as any).custom_domain}`
    : `${publicBaseUrl()}/sites/${(t as any).slug}`;
  const pagePath = pageSlug && pageSlug !== 'index' && pageSlug !== '/' ? `/${pageSlug.replace(/^\/+/, '')}` : '';
  const listingUrl = `${base}${pagePath}`;

  const html = await renderListingQrPackHtml({
    embedId,
    listingUrl,
    headline: typeof c.headline === 'string' ? c.headline : '',
    address: typeof c.address === 'string' ? c.address : '',
    price: typeof c.price === 'string' ? c.price : '',
    attribution:
      [(t as any).business_name || (t as any).template_name, (t as any).custom_domain]
        .filter(Boolean)
        .join(' · ') || 'Listed with QuickSites',
  });

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
