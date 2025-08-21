// app/api/_debug/host/route.ts
import { NextResponse } from 'next/server';
export function GET(req: Request) {
  const h = new Headers(req.headers);
  return NextResponse.json({
    host: h.get('host'),
    xForwardedHost: h.get('x-forwarded-host'),
    url: new URL(req.url).toString(),
  });
}
