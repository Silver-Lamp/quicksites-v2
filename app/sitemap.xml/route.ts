export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  let host = new URL(req.url).host;
  const normalized = host.replace(/^www\./, '');
  return NextResponse.redirect(`https://${host}/sitemap.xml/${normalized}`, 307);
}
