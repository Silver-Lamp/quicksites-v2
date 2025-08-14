import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function pxFromInches(inches:number, dpi=300){ return Math.round(inches * dpi); }

export async function GET(req: NextRequest, { params }: { params: { merchantId: string } }) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // Ownership
  const { data: merchant } = await supa.from('merchants')
    .select('id, display_name, name, review_code')
    .eq('id', params.merchantId)
    .maybeSingle();
  if (!merchant) return new NextResponse('Not found', { status: 404 });

  const url = new URL(req.url);
  const shape = (url.searchParams.get('shape') || 'round') as 'round'|'square';
  const sizeIn = Number(url.searchParams.get('sizeIn') || 2.0);  // 2 inch default
  const text = url.searchParams.get('text') || 'Scan to review';

  const base = process.env.APP_BASE_URL || 'https://delivered.menu';
  const target = `${base}/r/${merchant.review_code || ''}`;

  // QR as SVG string (no margins)
  const qrSvg = await QRCode.toString(target, { type: 'svg', width: pxFromInches(sizeIn)*0.6, margin: 0 });

  // Build SVG sticker
  const px = pxFromInches(sizeIn);
  const brand = 'delivered.menu';
  const chef = merchant.display_name || merchant.name || 'Chef';

  const radius = shape === 'round' ? px/2 : 24; // rounded square corners
  const mask = shape === 'round'
    ? `<circle cx="${px/2}" cy="${px/2}" r="${px/2}" />`
    : `<rect x="0" y="0" width="${px}" height="${px}" rx="${radius}" ry="${radius}" />`;

  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <defs>
    <clipPath id="clip">${mask}</clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="${px}" height="${px}" fill="#ffffff"/>
    <!-- brand stripe -->
    <rect x="0" y="${px*0.72}" width="${px}" height="${px*0.28}" fill="#111111"/>
    <!-- QR -->
    <g transform="translate(${px*0.2}, ${px*0.14}) scale(${(px*0.6)/(px*0.6)})">
      ${qrSvg.replace(/<\?xml.*\?>/, '').replace(/<svg[^>]*>|<\/svg>/g, '')}
    </g>
    <!-- text -->
    <text x="${px*0.52}" y="${px*0.18}" font-size="${px*0.10}" font-weight="700" fill="#111111">Scan to review</text>
    <text x="${px*0.52}" y="${px*0.30}" font-size="${px*0.085}" fill="#444444">${chef}</text>
    <text x="${px*0.04}" y="${px*0.90}" font-size="${px*0.11}" font-weight="700" fill="#ffffff">${brand}</text>
  </g>
</svg>`;

  return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
}
