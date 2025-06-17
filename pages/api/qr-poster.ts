import { createCanvas, loadImage } from 'canvas';
import { json } from '@/lib/api/json';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

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

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !campaign) return json({ error: 'Campaign not found' });

  const campaignUrl = `https://quicksites.ai/support/${slug}`;
  const qrCanvas = await QRCode.toCanvas(campaignUrl, {
    margin: 1,
    width: 300,
  });

  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Optional: Draw header and logo
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

  // Optional logo if provided
  if (campaign.logo_url) {
    const img = await loadImage(campaign.logo_url);
    ctx.drawImage(img, 600, 20, 160, 60);
  }

  const buffer = canvas.toBuffer('image/png');
  res.setHeader('Content-Type', 'image/png');
  res.send(buffer);
}
