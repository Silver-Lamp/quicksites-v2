// app/api/posters/[slug]/route.ts
import { createClient } from '@supabase/supabase-js';
import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!campaign || error) {
    return new Response('Campaign not found', { status: 404 });
  }

  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext('2d');

  const campaignUrl = `https://quicksites.ai/support/${slug}`;

  const qrCanvas = createCanvas(300, 300);
  await QRCode.toCanvas(qrCanvas, campaignUrl, { margin: 1, width: 300 });

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('Support This Mission', 40, 60);

  ctx.fillStyle = '#0f0';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(campaign.headline, 40, 110);

  ctx.drawImage(qrCanvas, 250, 160);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px sans-serif';
  ctx.fillText(campaignUrl, 60, 850);

  if (campaign.logo_url) {
    try {
      const img = await loadImage(campaign.logo_url);
      ctx.drawImage(img, 600, 20, 160, 60);
    } catch {
      /* ignore logo errors */
    }
  }

  const buf = canvas.toBuffer('image/png');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

  return new Response(ab, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${slug}-poster.png"`,
      'Content-Length': String(ab.byteLength),
      'Cache-Control': 'public, max-age=604800',
    },
  });
}
