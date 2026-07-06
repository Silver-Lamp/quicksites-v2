// app/api/claim/verify/send/route.ts
//
// Step 1 of claim verification: text a one-time code to the phone on the restaurant's
// public listing (server-derived — the claimer never supplies the number). Token-gated
// to a still-claimable listing_import draft, rate-limited per template + per IP.
// See docs/CLAIM_VERIFICATION_PLAN.md.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySiteClaimToken } from '@/lib/auth/siteClaimToken';
import { generateCode, hashCode, maskPhone, CODE_TTL_MS } from '@/lib/auth/claimVerify';
import { resolveListingPhone } from '@/lib/claim/resolveListingPhone';
import { sendSms } from '@/lib/sms/sendSms';
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

  const payload = verifySiteClaimToken(token);
  if (!id || !payload || payload.templateId !== id) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
  }

  const supa = db();
  const { data: tpl } = await supa
    .from('templates')
    .select('id, slug, claim_source, data')
    .eq('id', id)
    .maybeSingle();
  if (!tpl || (tpl as any).claim_source !== 'listing_import') {
    return NextResponse.json({ error: 'not_claimable' }, { status: 409 });
  }

  const phone = resolveListingPhone(tpl as any);
  if (!phone) {
    // No listing phone to verify against → route to the manual (operator) path.
    return NextResponse.json({ error: 'no_phone', manual: true }, { status: 422 });
  }

  const ip = clientIp(req);
  const perTemplate = await checkRateLimit(`cv:send:tpl:${id}`, 3, 3600);
  const perIp = await checkRateLimit(`cv:send:ip:${ip}`, 6, 3600);
  if (!perTemplate.ok || !perIp.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error: insErr } = await supa.from('claim_verifications').insert({
    template_id: id,
    channel: 'sms',
    destination: phone,
    code_hash: hashCode(code, id),
    attempts: 0,
    sent_count: 1,
    expires_at: expiresAt,
    created_ip: ip,
  });
  if (insErr) return NextResponse.json({ error: 'server_error' }, { status: 500 });

  const sent = await sendSms(
    phone,
    `Your delivered.menu verification code is ${code}. It expires in 10 minutes.`,
  );
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error === 'sms_not_configured' ? 'sms_not_configured' : 'send_failed' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, masked: maskPhone(phone) });
}
