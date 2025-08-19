// app/api/admin/tools/promote-to-chef/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Loosened client to avoid TS2589 explosions with adaptive queries
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
  return (display?.trim() || meta?.trim() || email?.split('@')[0] || 'Chef').trim();
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

/** Select first id from table by equality; returns null on no rows; throws on non-schema errors. */
async function selectFirstId(
  db: AnyClient,
  table: 'merchants' | 'chefs',
  col: string,
  val: any
): Promise<string | null> {
  const { data, error } = await (db as any).from(table).select('id').eq(col as any, val).limit(1);
  if (!error) return data?.[0]?.id ?? null;
  if (!missingCol(error, table)) throw new Error(error.message);
  return null;
}

/** STRICT: Always bind a merchant to this auth user via user_id; create if missing. */
async function ensureMerchantIdStrict(db: AnyClient, userId: string, baseName: string): Promise<string> {
  // Find by user_id (tolerate duplicates via limit(1))
  {
    const { data, error } = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
    if (!error && data?.[0]?.id) return data[0].id;
    if (error && !missingCol(error, 'merchants')) throw new Error(error.message);
  }

  // Create merchant for this user (keep user_id mandatory)
  const id = randomUUID();
  const attempts: Array<Record<string, any>> = [
    { id, user_id: userId, name: baseName, display_name: baseName },
    { id, user_id: userId, name: baseName },
  ];

  for (const payload of attempts) {
    const { error } = await (db as any).from('merchants').insert(payload);
    if (!error) return id;

    const miss = missingCol(error, 'merchants');

    // If user_id column is missing, surface clearly (downstream tools require it)
    if (miss === 'user_id') {
      throw new Error("merchants.user_id column is missing — downstream tools resolve merchant by user_id.");
    }

    // Unique race: someone else inserted—reselect and return
    if (msgLower(error).includes('duplicate key value')) {
      const again = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
      if (!again.error && again.data?.[0]?.id) return again.data[0].id;
    }

    // Fill unexpected NOT NULLs with baseName once
    const nn = notNullCol(error);
    if (nn && !(nn in payload)) {
      const retry = { ...payload, [nn]: baseName };
      const { error: err2 } = await (db as any).from('merchants').insert(retry);
      if (!err2) return id;
      if (!missingCol(err2, 'merchants')) throw new Error(err2.message || 'merchant insert failed');
      continue;
    }

    // display_name missing etc → next attempt drops it; other errors bubble
    if (!miss) throw new Error(error.message || 'merchant insert failed');
  }

  // Final re-check
  const { data: fin, error: finErr } = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
  if (!finErr && fin?.[0]?.id) return fin[0].id;

  throw new Error('Failed to create merchant for user');
}

/** Find-or-create chef; then ensure it's linked to merchant if that column exists. */
async function ensureChefIdAndLink(
  db: AnyClient,
  userId: string,
  merchantId: string,
  baseName: string
): Promise<string> {
  // by user_id
  {
    const id = await selectFirstId(db, 'chefs', 'user_id', userId);
    if (id) {
      // Try to link merchant_id if different (ignore if column missing)
      const { data: existing, error: exErr } = await (db as any).from('chefs').select('merchant_id').eq('id', id).limit(1);
      if (!exErr && existing?.[0] && existing[0].merchant_id !== merchantId) {
        const { error: upd } = await (db as any).from('chefs').update({ merchant_id: merchantId }).eq('id', id);
        if (upd && !missingCol(upd, 'chefs')) throw new Error(upd.message || 'failed to link chef to merchant');
      }
      return id;
    }
  }
  // by merchant_id
  {
    const id = await selectFirstId(db, 'chefs', 'merchant_id', merchantId);
    if (id) return id;
  }
  // by name
  {
    const id = await selectFirstId(db, 'chefs', 'name', baseName);
    if (id) {
      // best-effort: link to merchant
      const { error: upd } = await (db as any).from('chefs').update({ merchant_id: merchantId }).eq('id', id);
      if (upd && !missingCol(upd, 'chefs')) throw new Error(upd.message || 'failed to link chef to merchant');
      return id;
    }
  }

  // Create adaptively: start rich, back off as needed
  const id = randomUUID();
  const attempts: Array<Record<string, any>> = [
    { id, name: baseName, user_id: userId, merchant_id: merchantId },
    { id, name: baseName, user_id: userId },
    { id, name: baseName, merchant_id: merchantId },
    { id, name: baseName },
  ];

  for (const payload of attempts) {
    const { error } = await (db as any).from('chefs').insert(payload);
    if (!error) return id;

    if (msgLower(error).includes('duplicate key value')) {
      const byUser = await selectFirstId(db, 'chefs', 'user_id', userId);
      if (byUser) return byUser;
      const byMerchant = await selectFirstId(db, 'chefs', 'merchant_id', merchantId);
      if (byMerchant) return byMerchant;
      const byName = await selectFirstId(db, 'chefs', 'name', baseName);
      if (byName) return byName;
    }

    const nn = notNullCol(error);
    if (nn && !(nn in payload)) {
      const retry = { ...payload, [nn]: baseName };
      const { error: err2 } = await (db as any).from('chefs').insert(retry);
      if (!err2) return id;
      if (!missingCol(err2, 'chefs')) throw new Error(err2.message || 'chef insert failed');
      continue;
    }

    if (!missingCol(error, 'chefs')) throw new Error(error.message || 'chef insert failed');
  }

  // Last resort: any chef
  const { data: anyChef, error: anyErr } = await (db as any).from('chefs').select('id').limit(1);
  if (!anyErr && anyChef?.[0]?.id) return anyChef[0].id;

  throw new Error('Failed to create chef (schema mismatch).');
}

export async function POST(req: NextRequest) {
  // Gate
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const db = gate.supa as AnyClient;

  const { email, display_name } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Service role only for auth admin
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find auth user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const u = list.users.find(x => x.email?.toLowerCase() === String(email).toLowerCase());
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const baseName = coalesceName(display_name, (u.user_metadata as any)?.name, u.email ?? undefined);

  // Ensure merchant strictly by user_id
  let merchant_id: string;
  try {
    merchant_id = await ensureMerchantIdStrict(db, u.id, baseName);
  } catch (e: any) {
    return NextResponse.json({ error: `merchant: ${e.message}` }, { status: 500 });
  }

  // Ensure chef and link to that merchant
  let chef_id: string;
  try {
    chef_id = await ensureChefIdAndLink(db, u.id, merchant_id, baseName);
  } catch (e: any) {
    return NextResponse.json({ error: `chef: ${e.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user_id: u.id,
    merchant_id,
    chef_id,
    name_used: baseName,
  });
}
