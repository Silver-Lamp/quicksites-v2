// app/api/auth/cookie-dump/route.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    rawCookieHeader: req.headers.get('cookie') ?? null,
    names: req.cookies.getAll().map(c => c.name),
  });
}
