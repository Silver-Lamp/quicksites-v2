// app/api/claim-site/route.ts
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { verifyVerifyGrant, DOMAIN_CLAIM_VERIFY_GRANT_COOKIE } from '@/lib/auth/claimVerify';
import { DOMAIN_CLAIM_VERIFICATION_ENABLED } from '@/lib/flags/domainClaimVerification';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Public claim endpoint (service-role) → throttle per IP.
  const limited = await rateLimitOr429(req, 'claim_site', 10, 3600);
  if (limited) return limited;

  const body = await req.json().catch(() => ({} as any));
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!slug) return Response.json({ error: 'Missing slug' }, { status: 400 });

  const { data: domain } = await supabase
    .from('domains')
    .select('id, domain, is_claimed')
    .eq('domain', slug)
    .maybeSingle();

  if (!domain) return Response.json({ error: 'Not found' }, { status: 404 });
  if ((domain as any).is_claimed) {
    return Response.json({ error: 'Already claimed' }, { status: 400 });
  }

  // Until email proof-of-control is enabled, perform NO privileged writes — the
  // claim stays PENDING (this closes the griefing / arbitrary-email / points-
  // farming vectors of the original body-derived flow).
  if (!DOMAIN_CLAIM_VERIFICATION_ENABLED) {
    return Response.json({
      pending: true,
      message: 'Claim requires email verification before it can be completed.',
    });
  }

  // Verified flow: require a browser grant proving THIS visitor passed the OTP for
  // this domain, plus a matching verified, unconsumed claim_verifications row for
  // the supplied email. Only then flip is_claimed and record the email.
  const domainId = String((domain as any).id);
  if (!EMAIL_RE.test(email)) return Response.json({ error: 'invalid_email' }, { status: 400 });

  const grant = req.cookies.get(DOMAIN_CLAIM_VERIFY_GRANT_COOKIE)?.value;
  if (!verifyVerifyGrant(grant, domainId)) {
    return Response.json({ error: 'not_verified' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { data: vrow } = await supabase
    .from('claim_verifications')
    .select('id')
    .eq('domain_id', domainId)
    .eq('channel', 'email')
    .eq('destination', email)
    .not('verified_at', 'is', null)
    .is('consumed_at', null)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!vrow) return Response.json({ error: 'not_verified' }, { status: 403 });

  const { error: updErr } = await supabase
    .from('domains')
    .update({ is_claimed: true, claimed_email: email, claimed_at: nowIso })
    .eq('id', domainId)
    .eq('is_claimed', false); // guard against a race / double-claim
  if (updErr) return Response.json({ error: 'server_error' }, { status: 500 });

  await supabase
    .from('claim_verifications')
    .update({ consumed_at: nowIso })
    .eq('id', (vrow as any).id);

  return Response.json({ success: true });
}
