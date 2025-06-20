import { NextApiRequest, NextApiResponse } from 'next';
import QRCode from 'qrcode';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { blockId, handle } = req.query;
  if (!blockId || !handle) return res.status(400).send('Missing params');

  const url = `https://quicksites.ai/world/${handle}#block-${blockId}`;
  try {
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 300 });
    const img = Buffer.from(qr.split(',')[1], 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length,
    });
    res.end(img);
  } catch (err) {
    res.status(500).send('QR generation error');
  }
}
