// app/api/admin/prospects/territory-score/route.ts
//
// "Where do we target next?" — scores the swept prospects into ranked map cells and,
// when the geo-recs LLM flag is on, narrates the top few as a plain-language brief.
// The deterministic score is also computed client-side for the map heat overlay; this
// route exists for the (metered, flag-gated) LLM narration + a server-authoritative
// ranking. Admin-only. See lib/prospects/territoryScore.ts.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listProspects } from '@/lib/outreach/prospects';
import { scoreTerritories } from '@/lib/prospects/territoryScore';
import { synthesizeTerritoryBrief } from '@/lib/prospects/synthesizeTerritories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CELL_DEGREES = 0.02;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body = score everything, narrate.
  }
  const narrate = body?.narrate !== false; // default on; caller can ask for score-only

  // Only open leads matter for "where next" — skip already-built/dismissed prospects.
  const prospects = await listProspects({ status: 'discovered', limit: 2000 });
  const territories = scoreTerritories(prospects, { cellDegrees: CELL_DEGREES });

  const brief = narrate ? await synthesizeTerritoryBrief(territories) : null;

  return NextResponse.json({
    ok: true,
    cellDegrees: CELL_DEGREES,
    count: territories.length,
    territories: territories.slice(0, 25),
    brief, // null when the flag is off or synthesis failed — UI falls back to scores
  });
}
