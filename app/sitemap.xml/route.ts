// app/sitemap.xml/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const host = new URL(req.url).host;
  return NextResponse.redirect(`https://${host}/sitemap.xml/${host}`, 307);
}
