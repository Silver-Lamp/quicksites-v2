import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Loosened client to avoid TS explosions with adaptive queries
type AnyClient = SupabaseClient<any, any, any>;

const msgLower = (e: any) => `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
const notNullCol = (e: any) => (msgLower(e).match(/null value in column "(.+?)"/)?.[1] ?? null);
const missingCol = (e: any, table?: string) => {
  const m = msgLower(e);
  if (!table) return /does not exist|could not find the/.test(m);
  const a = m.match(new RegExp(`could not find the '(.+?)' column of '${table}'`));
  if (a?.[1]) return a[1];
  const b = m.match(new RegExp(`column "(.+?)" of relation "${table}" does not exist`));
  if (b?.[1]) return b[1];
  const c = m.match(new RegExp(`column ${table}\\.([a-z0-9_]+) does not exist`));
  if (c?.[1]) return c[1];
  return /does not exist|could not find the/.test(m) ? 'unknown' : null;
};

function coalesceName(display?: string, meta?: string, email?: string) {
  return (display?.trim() || meta?.trim() || email?.split('@')[0] || 'Merchant').trim();
}

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach(c => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
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
  return { code: 200 as const, supa: supa as AnyClient };
}

/** STRICT: Always bind a merchant to this auth user via user_id; create if missing. */
async function ensureMerchantIdStrict(db: AnyClient, userId: string, baseName: string): Promise<string> {
  // find by user_id
  {
    const { data, error } = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
    if (!error && data?.[0]?.id) return data[0].id;
    if (error && !missingCol(error, 'merchants')) throw new Error(error.message);
  }

  // create merchant for this user (keep user_id mandatory)
  const id = randomUUID();
  const attempts: Array<Record<string, any>> = [
    { id, user_id: userId, name: baseName, display_name: baseName },
    { id, user_id: userId, name: baseName },
  ];

  for (const payload of attempts) {
    const { error } = await (db as any).from('merchants').insert(payload);
    if (!error) return id;

    const miss = missingCol(error, 'merchants');

    // if user_id column is missing, surface clearly
    if (miss === 'user_id') {
      throw new Error("merchants.user_id column is missing — tools resolve merchant by user_id.");
    }

    // unique race: someone else inserted—reselect and return
    if (msgLower(error).includes('duplicate key value')) {
      const again = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
      if (!again.error && again.data?.[0]?.id) return again.data[0].id;
    }

    // fill unexpected NOT NULLs with baseName
    const nn = notNullCol(error);
    if (nn && !(nn in payload)) {
      const retry = { ...payload, [nn]: baseName };
      const { error: err2 } = await (db as any).from('merchants').insert(retry);
      if (!err2) return id;
      if (!missingCol(err2, 'merchants')) throw new Error(err2.message || 'merchant insert failed');
      continue;
    }

    if (!miss) throw new Error(error.message || 'merchant insert failed');
  }

  // final re-check
  const { data: fin, error: finErr } = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
  if (!finErr && fin?.[0]?.id) return fin[0].id;

  throw new Error('Failed to create merchant for user');
}

export async function POST(req: NextRequest) {
  // gate
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const db = gate.supa as AnyClient;

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const nameIn = (body?.name ?? body?.display_name) as string | undefined;
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // service role only for auth admin calls
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // find auth user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const u = list.users.find(x => x.email?.toLowerCase() === email);
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const baseName = coalesceName(nameIn, (u.user_metadata as any)?.name, u.email ?? undefined);

  // ensure merchant strictly by user_id
  let merchant_id: string;
  try {
    merchant_id = await ensureMerchantIdStrict(db, u.id, baseName);
  } catch (e: any) {
    return NextResponse.json({ error: `merchant: ${e.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user_id: u.id,
    merchant_id,
    name_used: baseName,
  });
}
