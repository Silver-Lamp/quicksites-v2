// app/api/commerce/deck-estimate/route.ts
//
// QuickSites proxy for the DeckSketch "instant deck estimate" seam
// (crosstalk/contracts/deck-estimate-embed.md, Status: LIVE). The deck_estimate
// block calls THIS route; we attach `site_ref` server-side and forward
// server-to-server to DeckSketch /api/estimate — so their endpoint stays off the
// public browser surface and attribution can't be spoofed from the page.
//
// Stateless + PII-free by design: this route sees dimensions only, never contact
// info. The lead (name/email/phone) is a SEPARATE step → ./lead/route.ts.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import {
  normalizeEstimateInput,
  hasMinimumInputs,
  requestDeckEstimate,
} from '@/lib/commerce/deckEstimate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Our own throttle in front of theirs (server-to-server, so key on the caller IP).
  const limited = await rateLimitOr429(req, 'deck-estimate', 40, 60);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // site_ref = the QS template id, attached SERVER-SIDE (client can't spoof attribution).
  const siteRef = typeof body?.templateId === 'string' ? body.templateId.slice(0, 64) : '';

  const input = normalizeEstimateInput(body);
  if (!hasMinimumInputs(input)) {
    return NextResponse.json(
      { error: 'Enter the deck area (or length × width) and pick a material.' },
      { status: 400 },
    );
  }

  const result = await requestDeckEstimate(input, siteRef);
  if (!result.ok) {
    // Surface a readable 400 (bad dims/tier); collapse upstream/network issues to 502.
    const status = result.status === 400 ? 400 : result.status === 429 ? 429 : 502;
    const error =
      status === 400
        ? result.error
        : status === 429
          ? 'Too many estimates right now — try again in a moment.'
          : 'Estimates are temporarily unavailable. Please try again shortly.';
    return NextResponse.json({ error }, { status });
  }

  // Short client cache — a given set of dimensions is a pure function of its inputs.
  return NextResponse.json(
    { estimate: result.estimate },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
