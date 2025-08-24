// app/api/admin/users/plan/route.ts
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
  return { code: 200 as const };
}

export async function PATCH(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as AnyClient;

  // also get the actor (admin) id for logging
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
  const actorId = auth?.user?.id ?? null;

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id ?? '').trim();
  const plan_key_raw = body?.plan_key;
  const plan_key = typeof plan_key_raw === 'string' ? plan_key_raw.trim() : undefined;
  let status = (body?.status ?? 'active') as string;
  const trial_days_raw = body?.trial_days;
  const trial_end_raw = body?.trial_end as string | undefined;
  const extend_days_raw = body?.extend_days;
  const end_mode = body?.end_mode as 'free' | 'activate' | undefined;
  const log_action = body?.log_action as string | undefined;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  // Ensure user_plans table exists; if not, guide the operator
  const exists = await admin
    .from('user_plans' as any)
    .select('user_id')
    .limit(1);

  if ((exists as any)?.error?.message?.toLowerCase?.().includes('does not exist')) {
    return NextResponse.json(
      {
        error:
          "user_plans table not found. Create it to enable plan edits here."
      },
      { status: 501 }
    );
  }

  // Load existing plan to compute changes
  const { data: existing } = await admin
    .from('user_plans' as any)
    .select('user_id, plan, status, trial_end, price_id, current_period_end, updated_at')
    .eq('user_id', user_id)
    .maybeSingle();

  let payload: any = {
    user_id,
    plan: plan_key ?? existing?.plan ?? 'free',
    status,
    updated_at: new Date().toISOString(),
  };

  // Handle extend trial flow
  if (typeof extend_days_raw !== 'undefined') {
    const extendDays = Number(extend_days_raw);
    if (!Number.isFinite(extendDays) || extendDays <= 0)
      return NextResponse.json({ error: 'extend_days must be a positive number' }, { status: 400 });
    const base = existing?.trial_end && new Date(existing.trial_end).getTime() > Date.now()
      ? new Date(existing.trial_end)
      : new Date();
    base.setUTCDate(base.getUTCDate() + extendDays);
    payload.trial_end = base.toISOString();
    payload.status = 'trialing';
  }

  // Derive trial_end when explicitly setting trial
  if (status === 'trialing' && typeof payload.trial_end === 'undefined') {
    let trial_end_iso: string | null = null;
    if (trial_end_raw) {
      const d = new Date(trial_end_raw);
      if (!Number.isNaN(d.getTime())) trial_end_iso = d.toISOString();
    }
    if (!trial_end_iso) {
      const days = Number(trial_days_raw ?? 7);
      const delta = Number.isFinite(days) && days > 0 ? days : 7;
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + delta);
      trial_end_iso = d.toISOString();
    }
    payload.trial_end = trial_end_iso;
  }

  // Handle end trial now
  if (end_mode) {
    if (end_mode === 'free') {
      payload.plan = 'free';
      payload.status = 'none';
      payload.trial_end = null;
    } else if (end_mode === 'activate') {
      payload.plan = plan_key ?? existing?.plan ?? 'pro';
      payload.status = 'active';
      payload.trial_end = null;
    }
  }

  const { data, error } = await admin
    .from('user_plans' as any)
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  // Opportunistic action logging (ignore errors)
  if (actorId) {
    try {
      await (admin as any)
        .from('user_action_logs')
        .insert({
          actor_id: actorId,
          target_user_id: user_id,
          action: end_mode ? `end_trial_${end_mode}` : (typeof extend_days_raw !== 'undefined' ? 'extend_trial' : (log_action ?? 'set_plan')),
          meta: { req: body, applied: payload, prev: existing },
          created_at: new Date().toISOString(),
        });
    } catch {}
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, plan: data });
}