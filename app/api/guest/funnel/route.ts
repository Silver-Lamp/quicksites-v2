// app/api/guest/funnel/route.ts
//
// Receives the pre-submit guest funnel steps (see lib/analytics/guestFunnel.ts for why they did
// not exist) and writes them to `guest_upgrade_events`.
//
// ⚠️ SERVER-SIDE WITH THE SERVICE ROLE, NOT A CLIENT INSERT — deliberately, and this is the whole
// reason the route exists rather than a two-line `supabase.from(...).insert()` in the component.
// The dead writer this replaces inserted from the browser. `guest_upgrade_events` currently has
// RLS DISABLED, so whether an anonymous browser insert lands depends on table GRANTs, and if a
// later hardening sweep locks the table down (this repo has done exactly that to a batch of
// anon-writable tables) those inserts start failing SILENTLY — leaving an empty table that looks
// like "nobody clicked". Building a silent-failure mode into the instrument whose entire job is to
// end a silent failure is the one outcome worth engineering against.
//
// ⚠️ THE USER ID IS DERIVED FROM THE SESSION, NEVER THE BODY. A client-supplied id would let anyone
// write rows attributed to another builder, and the funnel is about to be used to judge whether a
// fix worked.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  GUEST_FUNNEL_EVENTS,
  GUEST_FUNNEL_REASONS,
  GUEST_FUNNEL_SURFACES,
  triggerReason,
} from '@/lib/analytics/guestFunnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ⚠️ No email, no password, no provider message. The schema is the PII boundary: an added field is
// a decision to store it, so it should be as hard to do by accident as this makes it.
const bodySchema = z.object({
  event: z.enum(GUEST_FUNNEL_EVENTS),
  surface: z.enum(GUEST_FUNNEL_SURFACES).nullish(),
  reason: z.enum(GUEST_FUNNEL_REASONS).nullish(),
  pageUrl: z.string().max(300).nullish(),
  referrer: z.string().max(300).nullish(),
});

export async function POST(req: Request) {
  // Generous: a single builder legitimately emits several steps per session, and throttling the
  // measurement would bias it toward the people who clicked least.
  const limited = await rateLimitOr429(req, 'guest-funnel', 120, 3600);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // ⚠️ Anonymous users are the ENTIRE population here, so this route must accept them — but it
  // still requires a real session, so a row always belongs to someone who was actually building.
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { event, surface, reason, pageUrl, referrer } = parsed.data;

  // Best-effort by design: a failed beacon must never surface to the person signing up. It is
  // logged rather than swallowed, because a write that fails quietly is the bug being fixed.
  const { error } = await supabaseAdmin.from('guest_upgrade_events').insert({
    guest_user_id: user.id,
    event,
    trigger_reason: triggerReason(surface ?? null, reason ?? null),
    page_url: pageUrl ?? null,
    referrer: referrer ?? null,
  });
  if (error) {
    console.error('[guest-funnel] insert failed', { event, message: error.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
