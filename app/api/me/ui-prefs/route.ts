// app/api/me/ui-prefs/route.ts
//
// The signed-in user's interface preferences (walkthrough seen, etc).
//
// ⚠️ Anonymous callers are refused. A guest's session disappears when they do, so a preference
// stored against it is a row nobody will ever read again — and the walkthrough's whole point is
// surviving a logout. Guests keep the lightweight coach mark instead.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WALKTHROUGH_PREF_KEY } from '@/lib/onboarding/walkthrough';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ⚠️ An allowlist, not a free-form blob. The column is jsonb so the NEXT toggle needs no
// migration — but a client-writable open object is a place to stash anything, including enough
// to make the row expensive. Keys are declared here; unknown ones are dropped, not rejected, so
// an older client never fails against a newer server.
const KNOWN_KEYS = new Set<string>([WALKTHROUGH_PREF_KEY]);

const bodySchema = z.object({
  prefs: z.record(z.union([z.string(), z.boolean(), z.null()])),
});

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { data } = await (supabaseAdmin as any)
    .from('user_ui_prefs')
    .select('prefs')
    .eq('user_id', gate.user.id)
    .maybeSingle();

  // ⚠️ `{}` for a user with no row — a first-time visitor, which is exactly who should see the
  // walkthrough. Returning null here would read as "unknown" and suppress it forever.
  return NextResponse.json({ ok: true, prefs: data?.prefs ?? {} });
}

export async function PUT(req: NextRequest) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data.prefs)) {
    if (KNOWN_KEYS.has(k)) filtered[k] = v;
  }

  const { error } = await (supabaseAdmin as any)
    .from('user_ui_prefs')
    .upsert(
      { user_id: gate.user.id, prefs: filtered, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    console.error('[ui-prefs] upsert failed', { message: error.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prefs: filtered });
}
