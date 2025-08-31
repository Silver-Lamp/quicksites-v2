import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

async function serverAnon() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
    //   cookieEncoding: 'base64url',
      cookies: {
        getAll: async () => (await store).getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
) as AnyClient;

async function requireAdmin() {
  const supa = await serverAnon() as AnyClient;
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: row } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).limit(1);
  return row?.[0] ? user : null;
}

export async function GET(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const status = new URL(req.url).searchParams.get('status') || 'pending';
  let qb = admin.from('ai_pricing_audit').select('*').order('created_at', { ascending: false }).limit(200);
  if (status === 'pending') qb = qb.eq('applied', false);
  if (status === 'applied') qb = qb.eq('applied', true);

  const { data, error } = await qb;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const op: 'apply'|'revert'|'dismiss' = body.op;
  const ids: string[] = body.ids ?? [];

  if (!op || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  for (const id of ids) {
    const { data: audit } = await admin.from('ai_pricing_audit').select('*').eq('id', id).maybeSingle();
    if (!audit) continue;

    if (op === 'apply') {
      const next = audit.new;
      await admin.from('ai_model_pricing')
        .upsert(next, { onConflict: 'provider,model_code,modality' });
      await admin.from('ai_pricing_audit').update({
        applied: true, action: 'apply',
        reviewer_id: me.id, reviewed_at: new Date().toISOString(),
      }).eq('id', id);
    } else if (op === 'revert') {
      if (!audit.old) {
        // nothing to revert to; just mark dismissed
        await admin.from('ai_pricing_audit').update({
          applied: true, action: 'dismiss',
          reviewer_id: me.id, reviewed_at: new Date().toISOString(),
        }).eq('id', id);
      } else {
        await admin.from('ai_model_pricing')
          .upsert(audit.old, { onConflict: 'provider,model_code,modality' });
        await admin.from('ai_pricing_audit').update({
          applied: true, action: 'revert',
          reviewer_id: me.id, reviewed_at: new Date().toISOString(),
        }).eq('id', id);
      }
    } else if (op === 'dismiss') {
      await admin.from('ai_pricing_audit').update({
        applied: true, action: 'dismiss',
        reviewer_id: me.id, reviewed_at: new Date().toISOString(),
      }).eq('id', id);
    }
  }

  return NextResponse.json({ ok: true });
}
