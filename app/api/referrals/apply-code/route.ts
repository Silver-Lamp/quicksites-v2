// app/api/referrals/apply-code/route.ts
//
// Public: a visitor entered a referral code on the signup form. Validate it exists + is active,
// then set the same `qs_ref` cookie middleware sets from `?ref=` — so when they later create a
// merchant, ensureAttributionForMerchant binds it to the code and commissions accrue. Returns
// whether the code was accepted (so the form can confirm / clear a bad code). Rate-limited.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { codeIsUsable, normalizeCode } from '@/lib/referrals/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REF_COOKIE = 'qs_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 90; // 90 days — matches middleware

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'referral-apply-code', 30, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const code = normalizeCode(String(body?.code ?? ''));
  if (!code)
    return NextResponse.json(
      { ok: false, valid: false, error: 'Enter a referral code.' },
      { status: 400 }
    );

  if (!(await codeIsUsable(code))) {
    return NextResponse.json(
      { ok: false, valid: false, error: 'That referral code isn’t recognized.' },
      { status: 404 }
    );
  }

  const res = NextResponse.json({ ok: true, valid: true, code });
  res.cookies.set({
    name: REF_COOKIE,
    value: code,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REF_MAX_AGE,
  });
  return res;
}
