// app/api/admin/outreach/[id]/order-qrcode/route.ts
// (dir name avoids the .gitignore `*-qr/` pattern used for the importer's QR-image output)
//
// A print-ready DINER order QR for one outreach draft — encodes the public menu URL so a
// diner who scans it (window sticker / table tent) lands on the draft and can order. This
// is the demand-feeding counterpart to the owner-facing *claim* QR: a noindex draft has no
// traffic source, so placing these is how the "N tried to order" signal gets generated.
// Admin-gated. Returns image/png.
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('slug')
    .eq('id', params.id)
    .maybeSingle();
  const slug = (tpl as { slug?: string | null } | null)?.slug;
  if (!slug) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = menuSiteUrl(slug); // the diner-facing order URL (delivered.menu or /preview)
  const png = await QRCode.toBuffer(url, { width: 600, margin: 2, errorCorrectionLevel: 'M' });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${slug}-order-qr.png"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
