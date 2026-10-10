// app/api/admin/prospects/evolve-postcard/[prospectId]/route.ts
//
// GET ?side=front|back → the card's HTML for one prospect, as the printer would see it. For the
// operator to proof a card before mailing, and for a rep to print and hand-deliver one. Admin-gated.
// Renders even a blocked draft (so a reviewer can see why it is blocked), and says so in a header.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { selectEvolveMailable, renderEvolvePostcardFor } from '@/lib/outreach/evolvePostcardSend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ prospectId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { prospectId } = await params;
  const side = new URL(req.url).searchParams.get('side') === 'back' ? 'back' : 'front';
  const all = await selectEvolveMailable({ limit: 500 });
  const d = all.find((x) => x.prospect.id === prospectId);
  if (!d) return NextResponse.json({ error: 'not_eligible', detail: 'Not a built, unmailed restaurant draft with a website and no food ordering.' }, { status: 404 });
  const { frontHtml, backHtml } = await renderEvolvePostcardFor(d);
  return new NextResponse(side === 'back' ? backHtml : frontHtml, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-evolve-card-blocked': d.blocked ?? 'no', 'cache-control': 'no-store' },
  });
}
