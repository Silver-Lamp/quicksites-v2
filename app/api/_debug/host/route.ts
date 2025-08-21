import { NextResponse } from 'next/server';

export function GET(request: Request) {
  const h = new Headers(request.headers);
  return NextResponse.json({
    host: h.get('host'),
    x_forwarded_host: h.get('x-forwarded-host'),
    url: new URL(request.url).toString(),
  });
}
