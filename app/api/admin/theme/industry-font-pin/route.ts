// app/api/admin/theme/industry-font-pin/route.ts
//
// Add the typeface you are looking at to this industry's POOL.
//
// ⚠️ A POOL, NOT A SINGLE FACE. One typeface per industry makes every towing site in a town
// identical — the "obviously a template" tell we are trying to lose. An operator approves two
// or three that suit the trade and new sites spread across them deterministically. A pool of
// one behaves like a hard pin.
//
// ⚠️ IT CHANGES WHAT NEW SITES GET — IT DOES NOT RETHEME ANYTHING THAT EXISTS. Rewriting the
// typeface of sites somebody already shipped is a visible change to a real business's page and
// stays a separate, deliberate act (`scripts/backfill-font-pairs.mts`, which only fills gaps).
// The response says so, because a button whose blast radius is ambiguous gets pressed wrongly.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';
import {
  getIndustryFontPins,
  updateIndustryFontSet,
} from '@/lib/theme/industryFontOverrides';
import { fontPairForIndustry } from '@/lib/theme/industryFontMood';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  industry: z.string().min(1).max(64),
  fontPair: z.string().min(1).max(64).nullable(),
  /** 'clear' empties the pool and hands the industry back to the mood table. */
  op: z.enum(['add', 'remove', 'clear']).default('add'),
});

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ ok: true, pins: await getIndustryFontPins() });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { industry, fontPair, op } = parsed.data;

  // ⚠️ Checked here as well as in the store: an unknown id would resolve to NO font, which is
  // the system-stack bug this whole effort exists to fix.
  if (op !== 'clear' && fontPair !== null && !FONT_PAIRINGS[fontPair]) {
    return NextResponse.json({ error: `unknown pairing: ${fontPair}` }, { status: 400 });
  }

  try {
    const pins = await updateIndustryFontSet(industry, fontPair, op, gate.user?.id ?? null);
    // What a NEW site in this industry would now get — the thing the operator actually wants
    // confirmed, rather than "saved".
    const resolved = fontPairForIndustry(industry, 'preview', pins);
    const pool = pins[industry] ?? [];
    return NextResponse.json({
      ok: true,
      industry,
      pool,
      poolNames: pool.map((id) => FONT_PAIRINGS[id]?.name ?? id),
      // One example of what a new site would draw — the pool spreads, so this is illustrative.
      exampleResolves: resolved,
      note: pool.length
        ? 'New sites in this industry draw from this pool. Existing sites are unchanged.'
        : 'Pool cleared — this industry falls back to its default typeface. Existing sites are unchanged.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'pin failed' }, { status: 500 });
  }
}
