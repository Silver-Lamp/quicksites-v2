// app/api/claim/verify/email/confirm/route.ts
//
// Step 2 of the DOMAIN-claim email verification: check the OTP. On success, mark
// the verification verified and hand the browser a short-lived, domain-bound
// "verify grant" cookie that claim-site requires before completing the claim.
// Constant-time compare, per-code attempt cap, per-IP throttle.
// See docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  codeMatches,
  mintVerifyGrant,
  DOMAIN_CLAIM_VERIFY_GRANT_COOKIE,
  GRANT_TTL_MS,
  MAX_CONFIRM_ATTEMPTS,
} from '@/lib/auth/claimVerify';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { DOMAIN_CLAIM_VERIFICATION_ENABLED } from '@/lib/flags/domainClaimVerification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  if (!DOMAIN_CLAIM_VERIFICATION_ENABLED) {
    return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }
  const slug = String(body?.slug || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const code = String(body?.code || '').replace(/\D/g, '');

  if (!slug) return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  if (code.length !== 6) return NextResponse.json({ error: 'bad_code' }, { status: 400 });

  const ip = clientIp(req);
  const throttle = await checkRateLimit(`cv:email:confirm:ip:${ip}`, 30, 3600);
  if (!throttle.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const supa = db();
  const { data: domain } = await supa
    .from('domains')
    .select('id, is_claimed')
    .eq('domain', slug)
    .maybeSingle();
  if (!domain) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if ((domain as any).is_claimed) return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  const domainId = String((domain as any).id);

  const nowIso = new Date().toISOString();
  const { data: row } = await supa
    .from('claim_verifications')
    .select('id, code_hash, attempts')
    .eq('domain_id', domainId)
    .eq('channel', 'email')
    .eq('destination', email)
    .is('verified_at', null)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'expired' }, { status: 400 });

  const attempts = Number((row as any).attempts || 0) + 1;
  if (attempts > MAX_CONFIRM_ATTEMPTS) {
    await supa.from('claim_verifications').update({ expires_at: nowIso, attempts }).eq('id', (row as any).id);
    return NextResponse.json({ error: 'too_many' }, { status: 429 });
  }

  if (!codeMatches(code, domainId, (row as any).code_hash)) {
    await supa.from('claim_verifications').update({ attempts }).eq('id', (row as any).id);
    return NextResponse.json({ error: 'bad_code', remaining: MAX_CONFIRM_ATTEMPTS - attempts }, { status: 400 });
  }

  await supa
    .from('claim_verifications')
    .update({ attempts, verified_at: nowIso })
    .eq('id', (row as any).id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: DOMAIN_CLAIM_VERIFY_GRANT_COOKIE,
    value: mintVerifyGrant(domainId),
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(GRANT_TTL_MS / 1000),
  });
  return res;
}
