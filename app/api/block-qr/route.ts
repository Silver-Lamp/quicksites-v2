import { createCanvas, registerFont } from 'canvas';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

try {
  registerFont(path.resolve('./public/fonts/Inter.ttf'), { family: 'Inter' });
  registerFont(path.resolve('./public/fonts/Arial.ttf'), { family: 'Arial' });
} catch (err) {
  console.warn('⚠️ Font registration failed:', err);
}

function hash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function getOutputPath(handle: string, filename: string) {
  return path.resolve('public/generated-qr', handle, filename);
}

async function ensureDir(handle: string) {
  const dir = path.resolve('public/generated-qr', handle);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function createZipFromHandleDir(handle: string) {
  const dir = path.resolve('public/generated-qr', handle);
  const zipPath = path.resolve(dir, 'archive.zip');
  const output = await fs.open(zipPath, 'w');
  const archive = archiver('zip', { zlib: { level: 9 } });

  const stream = output.createWriteStream();
  archive.pipe(stream);

  const files = await fs.readdir(dir);
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.svg')) {
      archive.file(path.join(dir, file), { name: file });
    }
  }

  await archive.finalize();
  return `/generated-qr/${handle}/archive.zip`;
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
    mode = 'inline',
    zip = false,
    signed = false,
  } = await req.json();

  if (!blockId || !handle) {
    return Response.json({ error: 'Missing blockId or handle' }, { status: 400 });
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
    color: { dark: color, light: background },
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

  const filename = `${blockId}.${format}`;
  const relativePath = `/generated-qr/${handle}/${filename}`;

  if (mode === 'save') {
    await ensureDir(handle);
    const outputPath = getOutputPath(handle, filename);
    await fs.writeFile(outputPath, buffer);

    let zipPath: string | undefined;
    if (zip) {
      zipPath = await createZipFromHandleDir(handle);
    }

    return Response.json({
      ok: true,
      path: relativePath,
      zip: zipPath,
      signed: signed ? `${relativePath}?sig=fake-signature&expires=9999999999` : undefined,
    });
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': `image/${format}`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=604800',
      ETag: etag,
    },
  });
}
