// app/api/porchhearth/properties/[id]/route.ts
//
// QS proxy over PorchHearth's PUBLIC single-property read (crosstalk/contracts/neighborhood-stay-embed.md).
// Public read (no secret) — the neighborhood_stay block calls this to pull the property's served
// `hostAudioUrl` (the host-voice rail) for whichever PorchHearth property it's bound to. Per-IP throttled.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { getProperty, PorchHearthError } from '@/lib/porchhearth/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimitOr429(req, 'ph-property', 120, 3600);
  if (limited) return limited;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const data = await getProperty(id);
    return NextResponse.json(data);
  } catch (e: any) {
    const status = e instanceof PorchHearthError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'Property lookup failed' }, { status });
  }
}
