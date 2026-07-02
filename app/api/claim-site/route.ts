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
  // Public claim flow (service-role, body-derived) → throttle to blunt domain-
  // claim / steward_rewards / screenshot_queue spam. A verification-token
  // redesign (so the claimer must prove control of the email) is a tracked
  // follow-up; this is the interim abuse guard.
  const limited = await rateLimitOr429(req, 'claim_site', 10, 3600);
  if (limited) return limited;

  const { slug, email, anon } = await req.json();

  const { data: domain } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', slug)
    .maybeSingle();

  if (!domain || domain.is_claimed) {
    return Response.json({ error: 'Already claimed' }, { status: 400 });
  }

  const updates = {
    is_claimed: true,
    ...(anon ? {} : { claimed_email: email }),
  };

  await supabase.from('domains').update(updates).eq('domain', slug);
  await supabase.from('screenshot_queue').insert({ domain: slug });

  if (!anon) {
    await supabase.from('steward_rewards').insert({
      user_id: null, // future link to email/user
      site_domain: slug,
      reason: 'initial_claim',
      points: 5,
    });
  }

  return Response.json({ success: true });
}
