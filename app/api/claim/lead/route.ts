// app/api/claim/lead/route.ts
//
// Server-side find-or-create for the public /claim flow. Moves the lead read/write
// off the browser anon client so `leads` (PII) can be RLS-locked. Service role.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export async function POST(req: Request) {
  // Public claim flow (service-role, body-derived) → throttle unbounded lead /
  // user_action_logs inserts per IP. Verification-token redesign is a follow-up.
  const limited = await rateLimitOr429(req, 'claim_lead', 15, 3600);
  if (limited) return limited;

  const { templateId, email } = await req.json().catch(() => ({} as any));
  if (!templateId || !email) {
    return NextResponse.json({ error: 'Missing templateId or email' }, { status: 400 });
  }

  // find existing lead for this domain + email
  const { data: existing } = await admin
    .from('leads')
    .select('id')
    .eq('domain_id', templateId)
    .eq('email', email)
    .limit(1);

  let leadId: string | null = existing?.[0]?.id ?? null;

  if (leadId) {
    await admin
      .from('leads')
      .update({ outreach_status: 'claimed', notes: 'Claimed via /claim flow' })
      .eq('id', leadId);
  } else {
    const { data: inserted } = await admin
      .from('leads')
      .insert({
        email,
        domain_id: templateId,
        outreach_status: 'claimed',
        source: 'claim_flow',
        notes: 'New lead from /claim',
      })
      .select('id')
      .single();
    leadId = inserted?.id ?? null;
  }

  // best-effort action log (matches prior behavior)
  await admin
    .from('user_action_logs')
    .insert({
      lead_id: leadId,
      domain_id: templateId,
      action_type: 'claim_checkout_started',
      triggered_by: email,
    })
    .then(undefined, () => {});

  return NextResponse.json({ leadId });
}
