// app/api/mascot/quote/route.ts
//
// Proxy to HiveJournal's daily-quote service (contract crosstalk/contracts/quote-of-the-day.md,
// LIVE) for the "Say Dog" mascot's quote source. Server-side so the site id rides as `ref`
// (per-embedder attribution) and we avoid any browser CORS surprises. The upstream is cached
// ~1 fetch/UTC-day; we add our own edge cache headers. Degrades to 204 (no quote) on error —
// the mascot just falls back to another source client-side.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HJ_QUOTE_URL = 'https://hivejournalbackend-production.up.railway.app/api/quotes/daily';

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref') || 'anonymous';
  try {
    const r = await fetch(`${HJ_QUOTE_URL}?ref=${encodeURIComponent(ref)}`, {
      // Let the upstream's own caching + our revalidate window do the work.
      next: { revalidate: 3600 },
    });
    if (!r.ok) return new NextResponse(null, { status: 204 });
    const j = await r.json();
    const quote = typeof j?.quote === 'string' ? j.quote : '';
    if (!quote) return new NextResponse(null, { status: 204 });
    return NextResponse.json(
      { quote, author: typeof j?.author === 'string' ? j.author : '', date: j?.date ?? null },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
