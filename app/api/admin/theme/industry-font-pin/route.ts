// app/api/admin/theme/industry-font-pin/route.ts
//
// Pin the typeface you are looking at as the default for this industry.
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
  setIndustryFontPin,
} from '@/lib/theme/industryFontOverrides';
import { fontPairForIndustry } from '@/lib/theme/industryFontMood';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  industry: z.string().min(1).max(64),
  /** null unpins and falls back to the mood table. */
  fontPair: z.string().min(1).max(64).nullable(),
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
  const { industry, fontPair } = parsed.data;

  // ⚠️ Checked here as well as in the store: an unknown id would resolve to NO font, which is
  // the system-stack bug this whole effort exists to fix.
  if (fontPair !== null && !FONT_PAIRINGS[fontPair]) {
    return NextResponse.json({ error: `unknown pairing: ${fontPair}` }, { status: 400 });
  }

  try {
    const pins = await setIndustryFontPin(industry, fontPair, gate.user?.id ?? null);
    // What a NEW site in this industry would now get — the thing the operator actually wants
    // confirmed, rather than "saved".
    const resolved = fontPairForIndustry(industry, 'preview', pins);
    return NextResponse.json({
      ok: true,
      industry,
      pinned: fontPair,
      resolvesTo: resolved,
      name: resolved ? FONT_PAIRINGS[resolved]?.name ?? null : null,
      note: 'Applies to newly created sites. Existing sites keep the typeface they already have.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'pin failed' }, { status: 500 });
  }
}
