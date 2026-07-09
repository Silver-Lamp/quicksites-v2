// app/api/claim/verify/email/send/route.ts
//
// Step 1 of the DOMAIN-claim email verification: email a one-time code to the
// address the claimer typed, to prove they control it before the claim can
// complete. Gated by DOMAIN_CLAIM_VERIFICATION_ENABLED. Rate-limited per domain
// + per IP. Mirrors app/api/claim/verify/send (SMS) but for email.
// See docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateCode, hashCode, CODE_TTL_MS } from '@/lib/auth/claimVerify';
import { sendEmail } from '@/lib/email';
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

/** "j•••@example.com" — don't echo the full address back to the caller. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  const head = user.slice(0, 1);
  return `${head}•••@${domain}`;
}

export async function POST(req: Request) {
  if (!DOMAIN_CLAIM_VERIFICATION_ENABLED) {
    return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }
  const slug = String(body?.slug || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();

  if (!slug) return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const supa = db();
  const { data: domain } = await supa
    .from('domains')
    .select('id, domain, is_claimed')
    .eq('domain', slug)
    .maybeSingle();

  if (!domain) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if ((domain as any).is_claimed) return NextResponse.json({ error: 'already_claimed' }, { status: 409 });

  const domainId = String((domain as any).id);
  const ip = clientIp(req);
  const perDomain = await checkRateLimit(`cv:email:send:dom:${domainId}`, 3, 3600);
  const perIp = await checkRateLimit(`cv:email:send:ip:${ip}`, 6, 3600);
  if (!perDomain.ok || !perIp.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error: insErr } = await supa.from('claim_verifications').insert({
    domain_id: domainId,
    channel: 'email',
    destination: email,
    code_hash: hashCode(code, domainId),
    attempts: 0,
    sent_count: 1,
    expires_at: expiresAt,
    created_ip: ip,
  });
  if (insErr) return NextResponse.json({ error: 'server_error' }, { status: 500 });

  const sent = await sendEmail({
    to: email,
    subject: `Your verification code for ${slug}`,
    html: `<p>Your verification code to claim <strong>${slug}</strong> is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>
<p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, masked: maskEmail(email) });
}
