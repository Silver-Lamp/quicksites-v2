// app/api/claim-site/route.ts
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export async function POST(req: NextRequest) {
  // Public claim endpoint (service-role) → throttle per IP.
  const limited = await rateLimitOr429(req, 'claim_site', 10, 3600);
  if (limited) return limited;

  const body = await req.json().catch(() => ({} as any));
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  if (!slug) return Response.json({ error: 'Missing slug' }, { status: 400 });

  const { data: domain } = await supabase
    .from('domains')
    .select('domain, is_claimed')
    .eq('domain', slug)
    .maybeSingle();

  if (!domain) return Response.json({ error: 'Not found' }, { status: 404 });
  if (domain.is_claimed) {
    return Response.json({ error: 'Already claimed' }, { status: 400 });
  }

  // HARDENED (interim): this endpoint previously flipped `domains.is_claimed`,
  // wrote an arbitrary `claimed_email`, queued a screenshot, and granted
  // `steward_rewards` — all straight from an unverified request body. That is a
  // griefing (real-owner lockout), arbitrary-email, and points-farming vector.
  // Until the email proof-of-control flow lands, perform NONE of those
  // privileged writes: the claim stays PENDING and must be completed by a
  // verified flow. (No current caller depends on the old side effects.)
  return Response.json({
    pending: true,
    message: 'Claim requires email verification before it can be completed.',
  });
}
