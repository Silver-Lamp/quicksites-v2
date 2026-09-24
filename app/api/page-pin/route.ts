// app/api/page-pin/route.ts
//
// Unlock an unlisted `/for-<name>` page with its PIN. Deliberately a plain form POST with a redirect
// rather than JSON + fetch, so the gate works with no JavaScript — the same constraint the pages
// themselves are built under.
//
// ⚠️ THE RATE LIMIT IS THE ACTUAL SECURITY HERE, not the comparison. A six-digit PIN is a million
// combinations; unthrottled that is minutes of scripting. Throttled to 10/hour per IP it is years.
// So a limiter failure must NOT fail open — see below.
import { NextResponse } from 'next/server';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import {
  PAGE_PIN_MAX_ATTEMPTS_PER_HOUR,
  PAGE_PIN_TTL_MS,
  checkPagePin,
  mintPagePinGrant,
  pageRequiresPin,
  pagePinCookie,
} from '@/lib/auth/pagePin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Only ever redirect to a same-origin path we recognise — never to a caller-supplied URL. */
function safeReturnPath(pageKey: string): string {
  return `/for-${pageKey.replace(/[^a-z0-9-]/gi, '')}`;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const pageKey = String(form?.get('page') ?? '')
    .trim()
    .toLowerCase();
  const pin = String(form?.get('pin') ?? '');

  // An unknown or ungated page gets the same answer as a wrong PIN: no information about which
  // unlisted pages exist. Enumerating them is the first thing anyone poking at this would try.
  if (!pageKey || !pageRequiresPin(pageKey)) {
    return NextResponse.redirect(new URL('/', req.url), { status: 303 });
  }

  const dest = new URL(safeReturnPath(pageKey), req.url);

  // ⚠️ FAIL CLOSED on a limiter error. `checkRateLimit` swallows its insert failure, so a broken
  // ratelimit table would otherwise silently restore unlimited guessing — a gate that quietly stops
  // being a gate is worse than one that visibly breaks.
  let allowed = false;
  try {
    const ip = clientIp(req);
    const rl = await checkRateLimit(
      `page_pin:${pageKey}:${ip}`,
      PAGE_PIN_MAX_ATTEMPTS_PER_HOUR,
      3600
    );
    allowed = rl.ok;
  } catch {
    allowed = false;
  }
  if (!allowed) {
    dest.searchParams.set('e', 'slow');
    return NextResponse.redirect(dest, { status: 303 });
  }

  if (!checkPagePin(pageKey, pin)) {
    // No detail about why, and never an echo of what was submitted.
    dest.searchParams.set('e', '1');
    return NextResponse.redirect(dest, { status: 303 });
  }

  const res = NextResponse.redirect(dest, { status: 303 });
  res.cookies.set(pagePinCookie(pageKey), mintPagePinGrant(pageKey), {
    httpOnly: true, // the grant is never read by client JS
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(PAGE_PIN_TTL_MS / 1000),
  });
  return res;
}
