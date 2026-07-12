// app/api/me/seo-coach-prefs/route.ts
//
// The signed-in user's AI SEO Coaching email preferences. GET returns current prefs
// (defaults to enrolled when no row exists). PATCH updates the daily/weekly toggles —
// gated to paid plans via planAllows('ai_seo_coaching'). See docs/AI_SEO_COACHING.md.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';
import { planAllows } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const { data } = await (admin as any)
    .from('email_preferences')
    .select('seo_coach_daily, seo_coach_weekly, unsubscribed_all')
    .eq('user_id', user.id)
    .maybeSingle();

  const eligible = await planAllows(user.id, 'ai_seo_coaching');
  return NextResponse.json({
    ok: true,
    eligible,
    prefs: {
      daily: data?.seo_coach_daily ?? true,
      weekly: data?.seo_coach_weekly ?? true,
      unsubscribedAll: data?.unsubscribed_all ?? false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  if (!(await planAllows(user.id, 'ai_seo_coaching'))) {
    return NextResponse.json({ error: 'AI SEO Coaching is a paid-plan feature.' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (typeof body.daily === 'boolean') patch.seo_coach_daily = body.daily;
  if (typeof body.weekly === 'boolean') patch.seo_coach_weekly = body.weekly;
  // Turning either stream back on clears a prior blanket unsubscribe.
  if (patch.seo_coach_daily === true || patch.seo_coach_weekly === true) patch.unsubscribed_all = false;

  if (patch.seo_coach_daily === undefined && patch.seo_coach_weekly === undefined) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { error } = await (admin as any).from('email_preferences').upsert(patch, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Could not save preferences.' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
