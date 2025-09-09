// app/api/admin/merchants/ensure/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ─── env/clients ─── */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

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
    .from('profiles')
    .select('id,user_id,email')
    .eq('email', email)
    .maybeSingle();
  if (error) return null;
  return (data as any)?.user_id || (data as any)?.id || null;
}

async function assertAuth() {
  const sb = await getServerSupabase({ serviceRole: true } as any);
  const { data } = await sb.auth.getUser();
  const user = data?.user ?? null;
  if (!user) return { ok: false as const, status: 401, message: 'Not signed in' };

  // admin allow
  let profileAdmin = false;
  try {
    const { data: profile } = await sb.from('profiles').select('role,is_admin').eq('id', user.id).maybeSingle();
    if (profile) {
      const role = String((profile as any).role || '').toLowerCase();
      profileAdmin = (profile as any).is_admin === true || role === 'admin' || role === 'superadmin';
    }
  } catch {}
  const allowlistAdmin = ADMIN_EMAILS.includes(lower(user.email));
  const metaAdmin =
    String((user.user_metadata as any)?.role || '').toLowerCase() === 'admin' ||
    String((user.app_metadata as any)?.role || '').toLowerCase() === 'admin';

  return { ok: true as const, user, isAdmin: profileAdmin || allowlistAdmin || metaAdmin };
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
      // name/provider/default_platform_fee_bps have defaults in your table
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
