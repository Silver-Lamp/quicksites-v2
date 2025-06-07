import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_req, res) {
  const { data: campaigns } = await supabase
    .from('support_campaigns')
    .select('*');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="all-campaign-posters.zip"');

  const archive = archiver('zip');
  archive.pipe(res);

  for (const c of campaigns) {
    const url = \`https://yourdomain.com/support/\${c.slug}\`;
    const qrCanvas = await QRCode.toCanvas(url, { margin: 1, width: 300 });

    const canvas = createCanvas(800, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Support This Mission', 40, 60);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(c.headline, 40, 110);
    ctx.drawImage(qrCanvas, 250, 160);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText(url, 60, 850);

    if (c.logo_url) {
      const img = await loadImage(c.logo_url);
      ctx.drawImage(img, 600, 20, 160, 60);
    }

    const buffer = canvas.toBuffer('image/png');
    archive.append(buffer, { name: \`\${c.slug}.png\` });
  }

  await archive.finalize();
}
