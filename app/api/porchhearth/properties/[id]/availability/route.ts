// app/api/porchhearth/properties/[id]/availability/route.ts
//
// QS proxy over PorchHearth's PUBLIC availability check (crosstalk/contracts/neighborhood-stay-embed.md).
// Public read (no secret) — the neighborhood_stay booking form calls this to show available + a quote
// before the visitor submits a booking. Per-IP throttled.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { propertyAvailability, PorchHearthError } from '@/lib/porchhearth/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimitOr429(req, 'ph-availability', 60, 3600);
  if (limited) return limited;

  const { id } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const guestsRaw = url.searchParams.get('guests');
  if (!id || !from || !to) {
    return NextResponse.json({ error: 'id, from and to are required' }, { status: 400 });
  }
  const guests = guestsRaw != null && Number.isFinite(Number(guestsRaw)) ? Number(guestsRaw) : undefined;

  try {
    const data = await propertyAvailability(id, { from, to, ...(guests != null ? { guests } : {}) });
    return NextResponse.json(data);
  } catch (e: any) {
    const status = e instanceof PorchHearthError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'Availability request failed' }, { status });
  }
}
