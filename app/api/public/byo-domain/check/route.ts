// app/api/public/byo-domain/check/route.ts
//
// "Bring your own domain" step 1: where does this domain point today, and what are
// the exact two DNS records to move the WEBSITE here (email/MX untouched)? Public —
// the flow serves logged-out visitors (guest build) — read-only DNS resolution,
// rate-limited per IP like the other public endpoints.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { checkByoDomain } from '@/lib/domains/byoDomain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'byo-domain-check', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const raw = typeof body.domain === 'string' ? body.domain.trim() : '';
  if (!raw) return NextResponse.json({ error: 'domain is required.' }, { status: 400 });

  try {
    const result = await checkByoDomain(raw);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json(
      { error: 'That does not look like a domain — try something like yourbusiness.com.' },
      { status: 400 },
    );
  }
}
