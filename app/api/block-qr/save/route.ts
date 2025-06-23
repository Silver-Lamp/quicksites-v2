import { createCanvas, registerFont } from 'canvas';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// Load fonts if present
try {
  registerFont(path.resolve('./public/fonts/Inter.ttf'), { family: 'Inter' });
  registerFont(path.resolve('./public/fonts/Arial.ttf'), { family: 'Arial' });
} catch (err) {
  console.warn('⚠️ Font registration failed:', err);
}

function hash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

export async function POST(req: NextRequest) {
  const {
    blockId,
    handle,
    label = `block-${blockId}`,
    size = 512,
    font = 'Inter',
    fontSize = 20,
    color = '#000000',
    background = '#ffffff',
    format = 'png',
  } = await req.json();

  if (!blockId || !handle) {
    return new Response(JSON.stringify({ error: 'Missing blockId or handle' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `https://quicksites.ai/world/${handle}#block-${blockId}`;
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

  // 🔒 Save to disk
  const dir = path.resolve('public', 'generated-qr', handle);
  mkdirSync(dir, { recursive: true });
  const filename = `${blockId}.${format}`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, buffer);

  const publicUrl = `/generated-qr/${handle}/${filename}`;
  return new Response(JSON.stringify({ ok: true, path: publicUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
