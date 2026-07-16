// app/api/admin/merchants/ensure/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ─── env/clients ─── */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || requireEnv('SUPABASE_SECRET_KEY'));

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ─── helpers ─── */
const lower = (s?: string | null) => String(s || '').trim().toLowerCase();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const missingRelation = (e?: { code?: string; message?: string | null }) =>
  e?.code === '42P01' || /relation .* does not exist/i.test(e?.message || '');
const undefinedColumn = (e?: { code?: string; message?: string | null }) =>
  e?.code === '42703' || /column .* does not exist/i.test(e?.message || '');
const notNullViolation = (e?: { code?: string }) => e?.code === '23502';

/* Resolve profile user id by email (or null if none / table missing) */
async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id,email')
    .eq('email', email)
    .maybeSingle();
  if (error) return null;
  return (data as any)?.user_id || null;
}

async function assertAuth() {
  // Cookie-backed session client to resolve the caller. A service-role client presents
  // NO cookies (#243), so it returns no user here — which would 401 every caller.
  const sb = await getServerSupabase();
  const { data } = await sb.auth.getUser();
  const user = data?.user ?? null;
  if (!user) return { ok: false as const, status: 401, message: 'Not signed in' };

  // Canonical platform-admin check: ADMIN_EMAILS + the admin_users table (getAdminUser) —
  // self-writable role claims are not trusted. Non-admins can still self-provision below.
  const admin = await getAdminUser();
  return { ok: true as const, user, isAdmin: !!admin };
}

/* POST: { email } → { id, created } */
export async function POST(req: Request) {
  try {
    const auth = await assertAuth();
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    const { user, isAdmin } = auth;

    const body = await req.json().catch(() => ({}));
    const email = lower(body?.email);
    if (!isEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

    // Permitted if admin OR self-provision (acting on own email)
    const isSelf = lower(user.email) === email;
    const allowCreate = isAdmin || isSelf;

    // Does a merchant already exist for this email?
    const found = await supabaseAdmin.from('merchants').select('id').eq('email', email).maybeSingle();
    if (found.data?.id) {
      return NextResponse.json({ id: found.data.id, created: false }, { status: 200 });
    }
    if (found.error) {
      if (missingRelation(found.error)) {
        return NextResponse.json({ error: 'missing_merchants_table', hint: 'Create merchants table' }, { status: 500 });
      }
      if (undefinedColumn(found.error)) {
        return NextResponse.json({ error: 'missing_merchants_email_column', hint: 'Add merchants.email' }, { status: 500 });
      }
      return NextResponse.json({ error: found.error.message }, { status: 500 });
    }

    if (!allowCreate) {
      return NextResponse.json(
        { error: 'Not allowed to create merchant for this email (admin or self only)' },
        { status: 403 }
      );
    }

    // Your schema requires merchants.user_id NOT NULL.
    // Try profile.user_id for that email; if absent and self-provision, use current user.id.
    const profileUserId = await resolveUserIdByEmail(email);
    const userIdForMerchant = profileUserId ?? (isSelf ? user.id : null);

    if (!userIdForMerchant) {
      return NextResponse.json(
        {
          error: 'user_id_required',
          hint:
            'profiles/user not found for this email, and not self-provision. Ask the user to sign in once or create a profile, then retry.',
        },
        { status: 400 }
      );
    }

    const payload: any = {
      email,
      user_id: userIdForMerchant, // REQUIRED by your schema
      // name/provider have defaults in your table; fee config now lives on payment_accounts
    };

    const ins = await supabaseAdmin.from('merchants').insert(payload).select('id').single();
    if (ins.error) {
      if (notNullViolation(ins.error)) {
        return NextResponse.json(
          { error: 'merchants_user_id_not_null', hint: 'Ensure a valid user_id; your schema requires it.' },
          { status: 400 }
        );
      }
      if (missingRelation(ins.error)) return NextResponse.json({ error: 'missing_merchants_table' }, { status: 500 });
      if (undefinedColumn(ins.error)) return NextResponse.json({ error: 'merchants schema mismatch' }, { status: 500 });
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }

    return NextResponse.json({ id: ins.data.id, created: true }, { status: 200 });
  } catch (e: any) {
    console.error('[merchants/ensure] POST error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
