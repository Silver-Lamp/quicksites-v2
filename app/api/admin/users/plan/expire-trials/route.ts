// app/api/admin/users/plan/expire-trials/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
  const { data: auth } = await (supa as AnyClient).auth.getUser();
  if (!auth.user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await (supa as AnyClient)
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .limit(1);
  if (!admin?.[0]) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, actorId: auth.user.id };
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as AnyClient;

  const nowIso = new Date().toISOString();
  const { data: expiring = [] } = await admin
    .from('user_plans' as any)
    .select('user_id, plan, status, trial_end')
    .eq('status', 'trialing')
    .lt('trial_end', nowIso);

  if (!expiring?.length) return NextResponse.json({ ok: true, updated: 0 });

  const updates = expiring.map((r: any) => ({
    user_id: r.user_id,
    plan: 'free',
    status: 'none',
    trial_end: null,
    updated_at: nowIso,
  }));

  const { error } = await admin.from('user_plans' as any).upsert(updates, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // best-effort logging
  try {
    const logs = expiring.map((r: any) => ({
      actor_id: gate.actorId,
      target_user_id: r.user_id,
      action: 'expire_trial_auto',
      meta: { prev: r },
      created_at: nowIso,
    }));
    await (admin as any).from('user_action_logs').insert(logs);
  } catch {}

  return NextResponse.json({ ok: true, updated: updates.length });
}