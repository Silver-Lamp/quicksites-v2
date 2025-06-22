export const runtime = 'nodejs';

import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return json({ error: 'Missing slug' }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !campaign) {
    return json({ error: 'Campaign not found' }, { status: 404 });
  }

  const campaignUrl = `https://quicksites.ai/support/${slug}`;

  const qrCanvas = await QRCode.toCanvas(campaignUrl, {
    margin: 1,
    width: 300,
  });

  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('Support This Mission', 40, 60);

  ctx.fillStyle = '#0f0';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(campaign.headline, 40, 110);

  const qrImage = await loadImage(qrCanvas.toDataURL());
  ctx.drawImage(qrImage, 250, 160);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px sans-serif';
  ctx.fillText(campaignUrl, 60, 850);

  if (campaign.logo_url) {
    try {
      const img = await loadImage(campaign.logo_url);
      ctx.drawImage(img, 600, 20, 160, 60);
    } catch {
      console.warn('Failed to load logo image:', campaign.logo_url);
    }
  }

  const buffer = canvas.toBuffer('image/png');

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800', // 7 days
    },
  });
}
