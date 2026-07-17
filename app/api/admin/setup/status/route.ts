// app/api/admin/setup/status/route.ts
//
// Super-admin setup action items + their done/not-done state (registry:
// lib/admin/setupActions.ts). Powers the "Setup" alert card on the ops dashboard —
// so run-once provisioning (seed the author demo, seed starters) is a surfaced,
// one-click action instead of a console incantation.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveSetupActions } from '@/lib/admin/setupActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const actions = await resolveSetupActions(supabaseAdmin);
  return NextResponse.json({ ok: true, actions, pending: actions.filter((a) => !a.done).length });
}
