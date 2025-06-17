import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { createCanvas, loadImage } from 'canvas';
import { NextApiRequest, NextApiResponse } from 'next';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug } = req.query;
  if (!slug) return json({ error: 'Missing slug' });

  const { data: campaign } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!campaign) return json({ error: 'Not found' });

  const campaignUrl = `https://yourdomain.com/support/${slug}`;
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

  ctx.drawImage(qrCanvas as any, 250, 160);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px sans-serif';
  ctx.fillText(campaignUrl, 60, 850);

  if (campaign.logo_url) {
    const img = await loadImage(campaign.logo_url);
    ctx.drawImage(img, 600, 20, 160, 60);
  }

  const buffer = canvas.toBuffer('image/png');
  res.setHeader('Content-Disposition', `inline; filename="${slug}-poster.png"`);
  res.setHeader('Content-Type', 'image/png');
  res.send(buffer);
}
