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
import {
  isTradeKey,
  isLiveTrade,
  normalizeTradeInput,
  hasRequiredInputs,
  requestQuoteEstimate,
} from '@/lib/commerce/quoteEstimator';

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

  // Multi-trade (contract quote-estimate-embed.md): `trade` defaults to deck. Only trades
  // whose DeckSketch model is LIVE are estimable — gated trades return a clean "not yet"
  // (never a speculative call against an undeployed model). Unknown trade → 400.
  const trade = typeof body?.trade === 'string' && body.trade ? body.trade : 'deck';
  if (!isTradeKey(trade)) {
    return NextResponse.json({ error: 'Unknown estimate type.' }, { status: 400 });
  }
  if (!isLiveTrade(trade)) {
    return NextResponse.json(
      { error: 'Instant estimates for this trade aren’t available yet.', code: 'trade_not_live' },
      { status: 400 },
    );
  }

  // Non-deck LIVE trades go through the generic registry path; deck keeps its exact,
  // byte-identical shipped path (no risk to the money-adjacent live estimate).
  if (trade !== 'deck') {
    const tinput = normalizeTradeInput(trade, body);
    if (!hasRequiredInputs(trade, tinput)) {
      return NextResponse.json({ error: 'Fill in the required fields to get an estimate.' }, { status: 400 });
    }
    const r = await requestQuoteEstimate(trade, tinput, siteRef);
    if (!r.ok) {
      const status = r.status === 400 ? 400 : r.status === 429 ? 429 : 502;
      const error = status === 400 ? r.error
        : status === 429 ? 'Too many estimates right now — try again in a moment.'
        : 'Estimates are temporarily unavailable. Please try again shortly.';
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json({ estimate: r.estimate }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  }

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
