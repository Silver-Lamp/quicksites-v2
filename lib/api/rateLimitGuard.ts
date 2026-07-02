// lib/api/rateLimitGuard.ts
//
// Route-facing wrapper over checkRateLimit that returns a ready-to-return 429
// NextResponse. Kept out of lib/rateLimit.ts so that module stays free of the
// next/server import (which references web globals absent in the jsdom jest env).
import { NextResponse } from 'next/server';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

/**
 * Per-IP guard for public endpoints: consume one unit against `<name>:<ip>` and
 * return a ready-to-return 429 NextResponse when over the limit, else null.
 *
 *   const limited = await rateLimitOr429(req, 'contact', 5, 3600);
 *   if (limited) return limited;
 */
export async function rateLimitOr429(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const res = await checkRateLimit(`${name}:${clientIp(req)}`, limit, windowSeconds);
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please try again later.' },
      { status: 429 },
    );
  }
  return null;
}
