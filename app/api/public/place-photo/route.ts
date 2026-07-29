// app/api/public/place-photo/route.ts
//
// Public, keyless resolver for Google Places photos. The browser asks for a
// `photo_reference`; the server adds GOOGLE_PLACES_API_KEY and redirects to the image Google
// hands back. The key never reaches the client.
//
// Why a redirect rather than streaming the bytes: Google's photo endpoint answers with a 302
// to a public googleusercontent URL that needs no key. Following that ourselves would mean
// paying our own bandwidth to relay an image the browser can fetch directly, and would put a
// Node process in the path of every image on every restaurant page.
//
// ⚠️ COST — this endpoint spends money. Places Photo is billed per request, so an open,
// uncached proxy is a budget-drain amplifier: anyone could loop it. Three guards:
//   1. a per-IP rate limit,
//   2. a strict `ref` charset (a malformed ref must never reach a paid API), and
//   3. a long cache lifetime, so a repeat viewer costs nothing.
// Do not remove any of them to "make images load faster".
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { isValidPhotoReference } from '@/lib/places/photoProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONE_DAY = 86400;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = (url.searchParams.get('ref') || '').trim();
  const w = Math.min(Math.max(Number(url.searchParams.get('w')) || 1600, 64), 1600);

  // Reject before spending: a bad ref would be a billed Places call that returns nothing.
  if (!isValidPhotoReference(ref)) {
    return NextResponse.json({ error: 'invalid ref' }, { status: 400 });
  }

  const limited = await rateLimitOr429(req, 'place-photo', 300, 3600);
  if (limited) return limited;

  const key = process.env.GOOGLE_PLACES_API_KEY || '';
  if (!key) {
    // Fail quietly-but-honestly: a missing key is a config problem, not a client error, and
    // a broken <img> is better than a 500 page on a restaurant's storefront.
    return NextResponse.json({ error: 'photos unavailable' }, { status: 503 });
  }

  const upstream = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${w}&photo_reference=${encodeURIComponent(
    ref,
  )}&key=${key}`;

  let location: string | null = null;
  try {
    const res = await fetch(upstream, { redirect: 'manual' });
    location = res.headers.get('location');
  } catch {
    return NextResponse.json({ error: 'upstream failed' }, { status: 502 });
  }

  // Never hand back the upstream URL on failure — it contains the key.
  if (!location) return NextResponse.json({ error: 'photo not found' }, { status: 404 });

  const out = NextResponse.redirect(location, 302);
  out.headers.set('Cache-Control', `public, max-age=${ONE_DAY}, s-maxage=${ONE_DAY}`);
  return out;
}
