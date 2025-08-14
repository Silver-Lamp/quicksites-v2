// /app/api/public/review/qr/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime='edge';

export async function GET(req: NextRequest, { params }:{ params:{ token:string } }) {
  const size = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('size') || '512', 10), 128), 2048);
  const url = `${process.env.APP_BASE_URL}/rv/${params.token}`;
  const svg = await QRCode.toString(url, { type:'svg', width: size, margin: 0 });
  return new NextResponse(svg, { headers: { 'Content-Type':'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
