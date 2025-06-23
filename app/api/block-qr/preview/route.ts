import { createCanvas, registerFont } from 'canvas';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import path from 'node:path';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// Register custom fonts if available
try {
  registerFont(path.resolve('./public/fonts/Inter.ttf'), { family: 'Inter' });
  registerFont(path.resolve('./public/fonts/Arial.ttf'), { family: 'Arial' });
} catch (err) {
  console.warn('⚠️ Font registration failed:', err);
}

function hash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const blockId = searchParams.get('blockId');
  const handle = searchParams.get('handle');
  const label = searchParams.get('label') || `block-${blockId}`;
  const font = searchParams.get('font') || 'Inter';
  const fontSize = parseInt(searchParams.get('fontSize') || '20');
  const color = searchParams.get('color') || '#000000';
  const background = searchParams.get('background') || '#ffffff';
  const format = searchParams.get('format') || 'png';
  const size = parseInt(searchParams.get('size') || '512');

  if (!blockId || !handle) {
    return new Response('Missing blockId or handle', { status: 400 });
  }

  const url = `https://quicksites.ai/world/${handle}#block-${blockId}`;
  const etag = hash(`${url}-${label}-${font}-${fontSize}-${color}-${size}`);

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304 });
  }

  const qrCanvas = createCanvas(size, size);
  await QRCode.toCanvas(qrCanvas, url, {
    margin: 1,
    width: size,
    color: {
      dark: color,
      light: background,
    },
  });

  const canvas = createCanvas(size, size + fontSize + 20);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qrCanvas, 0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px "${font}"`;
  ctx.textAlign = 'center';
  ctx.fillText(label, canvas.width / 2, canvas.height - 10);

  const buffer =
    format === 'png'
      ? canvas.toBuffer()
      : (() => {
          throw new Error(`Unsupported format: ${format}`);
        })();

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': `image/${format}`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=604800', // 7 days
      ETag: etag,
    },
  });
}
