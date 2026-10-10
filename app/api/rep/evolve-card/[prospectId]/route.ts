// app/api/rep/evolve-card/[prospectId]/route.ts
//
// A rep's view of one Evolve postcard: GET ?token=<grant>&side=front|back → the printer's HTML,
// with the QR carrying the rep's code so a scan is credited to them. The rep usually has no
// account; the page they hold minted a signed 30-day grant naming their code
// (lib/rep/repActionToken.ts), the same grant the build button uses. Only a parked prospect by
// id — never a name or URL the rep typed — and only one the mailer would accept; a blocked draft
// gets a one-line HTML answer saying why, not a card.
import { NextResponse } from 'next/server';
import { verifyRepActionToken } from '@/lib/rep/repActionToken';
import { codeIsUsable } from '@/lib/referrals/codes';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { selectEvolveMailable, renderEvolvePostcardFor } from '@/lib/outreach/evolvePostcardSend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BLOCK_WORDS: Record<string, string> = {
  no_menu: 'We have not read this restaurant’s menu yet, so there is no card — the card says “built from your own menu”. Build the ordering page first, or go through the menu with them on a visit.',
  operational_claims: 'This draft carries a promise about the business we cannot stand behind, so it is held back from print. Tell Sandon which restaurant.',
  not_food: 'This listing is not a restaurant, so there is no ordering card for it.',
  no_address: 'This listing has no street address on file, so a card cannot be addressed. It can still be handed over.',
};

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1.5rem;line-height:1.5;color:#111"><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ prospectId: string }> }) {
  const limited = await rateLimitOr429(req, 'rep-evolve-card', 120, 3600);
  if (limited) return limited;
  const { prospectId } = await params;
  const url = new URL(req.url);
  const grant = verifyRepActionToken(url.searchParams.get('token'));
  if (!grant) return page('This link has expired', 'Ask Sandon for a fresh page link.', 403);
  if (!(await codeIsUsable(grant.code))) return page('This code is not active', 'Ask Sandon.', 403);
  if (!/^[0-9a-f-]{36}$/i.test(prospectId)) return page('Not found', 'No such restaurant.', 404);
  const side = url.searchParams.get('side') === 'back' ? 'back' : 'front';
  const [d] = await selectEvolveMailable({ ids: [prospectId], limit: 1 });
  if (!d) return page('No card yet', 'This restaurant needs a built ordering page with a menu, a website of its own and no online ordering before there is a card for it.', 404);
  if (d.blocked) return page('No card for this one', BLOCK_WORDS[d.blocked] ?? d.blocked, 200);
  const { frontHtml, backHtml } = await renderEvolvePostcardFor(d, grant.code);
  return new NextResponse(side === 'back' ? backHtml : frontHtml, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
