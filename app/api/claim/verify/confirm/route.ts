// app/api/claim/verify/confirm/route.ts
//
// Step 2 of claim verification: check the OTP. On success, mark the verification
// verified and hand the browser two httpOnly cookies — the pending site-claim token
// and a short-lived "verify grant" — so the post-login transfer (claimPendingSiteDraft)
// will actually run. Constant-time compare, per-code attempt cap, per-IP throttle.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySiteClaimToken, SITE_CLAIM_COOKIE, SITE_CLAIM_TTL_MS } from '@/lib/auth/siteClaimToken';
import {
  codeMatches,
  mintVerifyGrant,
  CLAIM_VERIFY_GRANT_COOKIE,
  GRANT_TTL_MS,
  MAX_CONFIRM_ATTEMPTS,
} from '@/lib/auth/claimVerify';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }
  const id = String(body?.id || '').trim();
  const token = String(body?.token || '');
  const code = String(body?.code || '').replace(/\D/g, '');

  const payload = verifySiteClaimToken(token);
  if (!id || !payload || payload.templateId !== id) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
  }
  if (code.length !== 6) return NextResponse.json({ error: 'bad_code' }, { status: 400 });

  const ip = clientIp(req);
  const throttle = await checkRateLimit(`cv:confirm:ip:${ip}`, 30, 3600);
  if (!throttle.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const supa = db();
  const nowIso = new Date().toISOString();
  const { data: row } = await supa
    .from('claim_verifications')
    .select('id, code_hash, attempts')
    .eq('template_id', id)
    .eq('channel', 'sms')
    .is('verified_at', null)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'expired' }, { status: 400 });

  const attempts = Number((row as any).attempts || 0) + 1;
  if (attempts > MAX_CONFIRM_ATTEMPTS) {
    // Burn the code so it can't be brute-forced further; the user can request a new one.
    await supa.from('claim_verifications').update({ expires_at: nowIso, attempts }).eq('id', (row as any).id);
    return NextResponse.json({ error: 'too_many' }, { status: 429 });
  }

  if (!codeMatches(code, id, (row as any).code_hash)) {
    await supa.from('claim_verifications').update({ attempts }).eq('id', (row as any).id);
    return NextResponse.json({ error: 'bad_code', remaining: MAX_CONFIRM_ATTEMPTS - attempts }, { status: 400 });
  }

  await supa
    .from('claim_verifications')
    .update({ attempts, verified_at: nowIso })
    .eq('id', (row as any).id);

  const next = `/login?next=${encodeURIComponent(`/admin/templates/${id}`)}`;
  const res = NextResponse.json({ ok: true, next });
  const secure = process.env.NODE_ENV === 'production';
  // The verify grant proves THIS browser passed the OTP; the site-claim cookie carries
  // the transfer token across login. Both are consumed by claimPendingSiteDraft.
  res.cookies.set({
    name: CLAIM_VERIFY_GRANT_COOKIE,
    value: mintVerifyGrant(id),
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: Math.floor(GRANT_TTL_MS / 1000),
  });
  res.cookies.set({
    name: SITE_CLAIM_COOKIE,
    value: token,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: Math.floor(SITE_CLAIM_TTL_MS / 1000),
  });
  return res;
}
