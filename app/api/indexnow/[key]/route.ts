// app/api/indexnow/[key]/route.ts
//
// Serves the IndexNow key-ownership file at /api/indexnow/<key>.txt on every host the app
// answers (custom domains + delivered.menu subdomains included — /api isn't host-rewritten
// by middleware). IndexNow fetches this to prove we own the key before honoring submissions.
// Returns 404 unless the requested filename exactly matches "<INDEXNOW_KEY>.txt".
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { indexNowKey } from '@/lib/seo/indexNow';

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key: file } = await ctx.params;
  const key = indexNowKey();
  if (!key || file !== `${key}.txt`) {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(key, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
