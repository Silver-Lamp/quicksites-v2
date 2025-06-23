// 🔧 Extracted helper functions for /block-qr route

import { createCanvas, registerFont, loadImage } from 'canvas';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import archiver from 'archiver';
import { NextRequest } from 'next/server';

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
  archive.finalize();
  return output;
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
  const canvas = createCanvas(size, size);
  await QRCode.toCanvas(canvas, url);
  const buffer = canvas.toBuffer();
  const filename = `${blockId}.${format}`;
  const filepath = path.resolve('public/generated-qr', handle, filename);
  await fs.writeFile(filepath, buffer);
}
