// app/api/porchhearth/properties/route.ts
//
// QS proxy over PorchHearth's PUBLIC rental read API (crosstalk/contracts/neighborhood-stay-embed.md,
// LIVE). Keeps the base URL server-side + adds our own per-IP throttle. No secret needed (read is
// public). The neighborhood_stay block's live-data mode fetches through here.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { listProperties, PorchHearthError } from '@/lib/porchhearth/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const numOr = (v: string | null): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export async function GET(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'ph-properties', 60, 3600);
  if (limited) return limited;

  const url = new URL(req.url);
  const geo = url.searchParams.get('geo');
  if (!geo) return NextResponse.json({ error: 'geo (lat,lng) is required' }, { status: 400 });

  try {
    const data = await listProperties({
      geo,
      radiusMi: numOr(url.searchParams.get('radius_mi')),
      guests: numOr(url.searchParams.get('guests')),
      city: url.searchParams.get('city') || undefined,
      state: url.searchParams.get('state') || undefined,
      limit: numOr(url.searchParams.get('limit')),
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const status = e instanceof PorchHearthError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'PorchHearth request failed' }, { status });
  }
}
