import { createCanvas } from 'canvas';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const canvas = createCanvas(100, 100);
  const buf = canvas.toBuffer('image/png');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(ab.byteLength),
      'Cache-Control': 'public, max-age=604800',
      ETag: 'etag',
    },
  });
}
